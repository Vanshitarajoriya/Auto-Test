#!/usr/bin/env node
// Deterministic card runner. No AI in this file or anything it imports: the verdict comes from Playwright assertions.
//   card -> read Module/Feature -> mapping.json -> pre-flight -> canary -> Playwright -> rules -> ClickUp
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import '../src/config.mjs'; // loads .env
import { loadMapping, lookupTests } from '../src/mapping.mjs';
import { preflight } from '../src/preflight.mjs';
import { getTask, readCardLabels, addComment, setStatus, createTask } from '../src/clickup.mjs';
import { collectTests, judge, canaryHealthy } from '../src/results.mjs';
import { buildComment, buildBug } from '../src/report.mjs';

const HELP = `Usage:
  node runner/run-card.mjs --task <clickup-task-id> [--post] [--post-status] [--create-bug]
  node runner/run-card.mjs --module <Module> --feature "<Feature>[, <Feature>]"   (no ClickUp needed)

Flags:
  --post                  comment the result on the card
  --post-status           also move the card to the pass/fail status (implies --post)
  --create-bug            create a bug card per failed test (needs CLICKUP_BUG_LIST_ID)
  --mapping <file>        use another mapping file (default: mapping.json; the demo uses demo/mapping.demo.json)
  --skip-network-checks   skip the dev reachability check (local self-test only)
Exit codes: 0 QA Passed | 1 failed / mapping error / suite broken | 2 blocked: environment | 3 needs fields / manual needed / partial`;

const EXIT = { 'QA Passed': 0, 'QA Failed': 1, 'Mapping error': 1, 'Suite broken': 1, 'Blocked: environment': 2 };

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const name = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) a[name] = true;
    else {
      a[name] = next;
      i++;
    }
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || process.argv.length < 3) {
  console.log(HELP);
  process.exit(0);
}
mkdirSync('results', { recursive: true });

const result = {
  taskId: args.task && args.task !== true ? args.task : undefined,
  module: args.module,
  features: args.feature ? String(args.feature).split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [],
  testIds: [],
  unmappedFeatures: [],
  verdict: null,
  aiCallsInVerdictPath: 0, // by design: this runner imports no AI code (checked by test SAFE-012)
  startedAt: new Date().toISOString(),
  runUrl: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined,
};

async function publish(comment) {
  if (!result.taskId || !(args.post || args['post-status'])) return;
  try {
    await addComment(result.taskId, comment);
    console.log('Posted comment to ClickUp.');
    if (args['post-status']) {
      const target = { 'QA Passed': process.env.STATUS_PASSED || 'QA Passed', 'QA Failed': process.env.STATUS_FAILED || 'QA Failed', 'Blocked: environment': process.env.STATUS_BLOCKED }[result.verdict];
      if (target) {
        await setStatus(result.taskId, target);
        console.log(`Moved card to "${target}".`);
      }
    }
    if (args['create-bug'] && result.verdict === 'QA Failed') {
      const listId = process.env.CLICKUP_BUG_LIST_ID;
      if (!listId) throw new Error('CLICKUP_BUG_LIST_ID is not set');
      for (const f of result.judged.failed) {
        const bug = buildBug(result, f);
        await createTask(listId, bug.name, bug.description);
        console.log(`Created bug card: ${bug.name}`);
      }
    }
  } catch (e) {
    console.error('WARNING: could not post to ClickUp (verdict unchanged):', e.message);
    result.postError = e.message;
  }
}

async function finish(verdict, extra = {}) {
  Object.assign(result, extra, { verdict, finishedAt: new Date().toISOString() });
  const comment = buildComment(result);
  console.log(`\n${'='.repeat(64)}\n${comment}\n${'='.repeat(64)}`);
  await publish(comment);
  const file = `results/${result.taskId || 'adhoc'}-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(`Result saved: ${file}`);
  process.exit(EXIT[verdict] ?? 3);
}

// Run Playwright's CLI with node directly, never through a shell: on Windows cmd.exe would treat the "|" in --grep as a pipe.
const PW_CLI = fileURLToPath(import.meta.resolve('@playwright/test/cli'));
const pw = (pwArgs, env = {}, quiet = false) =>
  spawnSync(process.execPath, [PW_CLI, 'test', ...pwArgs], {
    stdio: quiet ? 'ignore' : 'inherit',
    env: { ...process.env, PLAYWRIGHT_HTML_OPEN: 'never', ...env },
  });
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

// 1. Read the card
if (result.taskId) {
  try {
    const task = await getTask(result.taskId);
    Object.assign(result, readCardLabels(task), { cardName: task.name });
  } catch (e) {
    await finish('Blocked: environment', { reason: `could not read the ClickUp card: ${e.message}` });
  }
}

// 2. Mapping lookup (rules, not AI)
const look = lookupTests(loadMapping(typeof args.mapping === 'string' ? args.mapping : undefined), result.module, result.features);
result.testIds = look.ids;
result.unmappedFeatures = look.unmappedFeatures;
if (look.status === 'needs-fields') await finish('Needs fields', { reason: 'Please fill Module and Feature on this card.' });
if (look.status === 'manual-needed') await finish('Manual needed', { reason: look.reason });
console.log(`Card -> Module "${look.module}", tests: ${look.ids.join(', ')}`);

// 3. Pre-flight
const pf = await preflight({ skipNetwork: !!args['skip-network-checks'] });
for (const c of pf.checks) console.log(`  [${c.ok ? 'ok' : 'FAIL'}] ${c.name}${c.detail ? ` - ${c.detail}` : ''}`);
result.preflight = pf;
if (!pf.ok) await finish('Blocked: environment', { reason: 'pre-flight check failed' });

// 4. Canary: tests built to FAIL must fail, or the suite cannot be trusted
rmSync('results/canary.json', { force: true });
pw(['--project=canary', '--reporter=json'], { PLAYWRIGHT_JSON_OUTPUT_NAME: 'results/canary.json' }, true);
const canary = readJson('results/canary.json');
if (!canary || !canaryHealthy(collectTests(canary))) {
  await finish('Suite broken', { reason: 'canary tests did not fail as designed, so results cannot be trusted' });
}
console.log('  [ok] canary tests failed as designed');

// 5. Run the mapped tests
rmSync('results/last-run.json', { force: true });
const pattern = `(${look.ids.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}):`;
pw(['--grep', pattern, '--reporter=list,json,html'], { PLAYWRIGHT_JSON_OUTPUT_NAME: 'results/last-run.json' });

// 6. Verdict by rules
const report = readJson('results/last-run.json');
if (!report) await finish('Blocked: environment', { reason: 'Playwright produced no report (it crashed before running tests)' });
const judged = judge(collectTests(report), look.ids);
let verdict = judged.verdict;
if (verdict === 'QA Passed' && look.unmappedFeatures.length) verdict = 'Partial: manual needed';
await finish(verdict, { judged });
