#!/usr/bin/env node
// npm run doctor: checks everything first-day setup needs and says exactly what to fix next.
//   npm run doctor                      local checks + config + dev + ClickUp token
//   npm run doctor -- --task 86d38k0vn  also reads that real card and shows what the runner would do with it
// Flags: --mapping <file>  --offline (no network)  --skip-selftest
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { defaultAllowedHosts } from '../src/config.mjs';
import { assertAllowedUrl } from '../src/safety.mjs';
import { loadMapping, lookupTests, diffMapping } from '../src/mapping.mjs';
import { getTask, getUser, getList, readCardLabels, fieldOptions } from '../src/clickup.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const val = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const offline = flag('offline');
const tty = !process.env.NO_COLOR && process.stdout.isTTY;
const paint = (n, s) => (tty ? `\x1b[${n}m${s}\x1b[0m` : s);

const counts = { ok: 0, warn: 0, fail: 0 };
let firstFix = null;
const say = (kind, msg, fix) => {
  counts[kind]++;
  const sym = kind === 'ok' ? paint(32, '✓') : kind === 'warn' ? paint(33, '!') : paint(31, '✗');
  console.log(`  ${sym} ${msg}`);
  if (fix && kind !== 'ok') console.log(paint(2, `      -> ${fix}`));
  if (kind === 'fail' && !firstFix) firstFix = fix || msg;
};
const ok = (m) => say('ok', m);
const warn = (m, f) => say('warn', m, f);
const fail = (m, f) => say('fail', m, f);
const section = (t) => console.log(`\n${paint(1, t)}`);
const mask = (v) => (v.length <= 6 ? '***' : `${v.slice(0, 2)}***${v.slice(-2)}`);
const placeholder = (v) => !v || /[<>]|^your[_-]|changeme/i.test(v);

// 1. This computer
section('1. This computer');
const major = Number(process.versions.node.split('.')[0]);
major >= 18 ? ok(`Node ${process.versions.node}`) : fail(`Node ${process.versions.node} is too old`, 'install Node 18 or newer');
existsSync('node_modules/@playwright/test') ? ok('dependencies installed') : fail('dependencies are not installed', 'run: npm ci');
try {
  const { chromium } = await import('@playwright/test');
  existsSync(chromium.executablePath()) ? ok('Chromium is installed (UI tests can run)') : warn('Chromium is not installed (needed for UI tests only)', 'run: npx playwright install chromium');
} catch {
  warn('could not check Chromium', 'run: npm ci');
}
const claude = spawnSync('claude', ['--version'], { encoding: 'utf8' });
claude.status === 0 ? ok(`Claude Code ${claude.stdout.trim()}`) : warn('Claude Code CLI not found (only the authoring agent needs it)', 'run: npm install -g @anthropic-ai/claude-code');
existsSync('.env') ? ok('.env exists') : warn('no .env file', 'copy .env.example to .env and fill it (or set the variables in your shell)');
if (!flag('skip-selftest')) {
  const t = spawnSync('npx', ['playwright', 'test', '--project=selftest', '--reporter=line'], { encoding: 'utf8', shell: process.platform === 'win32' });
  const n = /(\d+) passed/.exec(t.stdout)?.[1];
  t.status === 0 ? ok(`guardrail self-tests pass (${n})`) : fail('guardrail self-tests FAIL', 'run: npm run selftest and read the failure before anything else');
}

// 2. Configuration
section('2. Configuration (.env or shell)');
const required = [['DEV_URL', 'the dev base URL (open question 1 below)'], ['MSG91_AUTHKEY', 'authkey of the dedicated automation account on dev'], ['TEST_RECIPIENTS', 'our own test number / inbox, comma-separated']];
const recommended = [['ALLOWED_HOSTS', 'set explicitly (dev host only); live hosts are always refused'], ['TEST_EMAIL', 'automation account login for UI tests'], ['TEST_PASSWORD', 'automation account login for UI tests'], ['CLICKUP_TOKEN', 'ClickUp personal API token (ClickUp Settings > Apps; the menu name may differ)']];
for (const [k, why] of required) {
  const v = process.env[k];
  !v ? fail(`${k} is not set`, why) : placeholder(v) ? fail(`${k} still looks like a placeholder`, why) : ok(`${k} = ${k.includes('KEY') || k.includes('TOKEN') ? mask(v) : v}`);
}
for (const [k, why] of recommended) {
  const v = process.env[k];
  !v || placeholder(v) ? warn(`${k} is not set`, why) : ok(`${k} = ${k.includes('PASSWORD') || k.includes('TOKEN') ? mask(v) : v}`);
}

// 3. Dev environment
section('3. Dev environment');
if (process.env.DEV_URL && !placeholder(process.env.DEV_URL)) {
  try {
    assertAllowedUrl(process.env.DEV_URL, { allowedHosts: defaultAllowedHosts() });
    ok('DEV_URL passes the dev allowlist (live hosts are refused)');
    if (!offline) {
      try {
        const res = await fetch(process.env.DEV_URL, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
        res.status < 500 ? ok(`dev is reachable from this machine (HTTP ${res.status})`) : fail(`dev answered HTTP ${res.status}`, 'ask the dev team whether dev is healthy');
      } catch (e) {
        fail(`dev is not reachable from this machine (${e.cause?.code || e.message})`, 'check VPN / IP allowlist. If GitHub Actions cannot reach dev either, you need a self-hosted runner (see README)');
      }
    }
  } catch (e) {
    fail(e.message, 'fix DEV_URL / ALLOWED_HOSTS');
  }
} else {
  warn('skipped: DEV_URL is not set yet', 'answer open question 1 below first');
}

// 4. ClickUp
section('4. ClickUp');
const mapping = loadMapping(val('mapping'));
if (offline) warn('skipped (--offline)');
else if (!process.env.CLICKUP_TOKEN) warn('skipped: CLICKUP_TOKEN is not set', 'create a personal API token and put it in .env');
else {
  try {
    const me = await getUser();
    ok(`token works (user: ${me.user?.username || me.user?.email || 'ok'})`);
    const taskId = val('task');
    if (!taskId) warn('no card checked yet', 'run: npm run doctor -- --task <card id>   (the id is the last part of the card URL)');
    else {
      const task = await getTask(taskId);
      ok(`card read: "${task.name}"`);
      const mod = fieldOptions(task, process.env.CLICKUP_MODULE_FIELD || 'Module');
      const feat = fieldOptions(task, process.env.CLICKUP_FEATURE_FIELD || 'Feature');
      for (const [label, f] of [['Module', mod], ['Feature', feat]]) {
        if (!f.exists) fail(`this card has no custom field named "${label}"`, `create the "${label}" field (SETUP.md step 2), or set CLICKUP_${label.toUpperCase()}_FIELD to its real name`);
        else ok(`field "${label}" exists (${f.type}, ${f.options.length || 'no'} options)`);
      }
      if (mod.exists && feat.exists) {
        const { module, features } = readCardLabels(task);
        const look = lookupTests(mapping, module, features);
        console.log(paint(2, `      card says: Module = ${module || '(empty)'}, Feature = ${features.join(', ') || '(empty)'}`));
        if (look.status === 'needs-fields') warn('the card has no Module/Feature value yet', 'pick them on the card: the runner will otherwise comment "Please fill Module and Feature"');
        else if (look.status === 'manual-needed') warn(`no tests mapped yet (${look.reason})`, 'expected for a new card: it would get "Manual needed", and Claude can author the tests (README, demo with Claude)');
        else ok(`${look.ids.length} test(s) would run: ${look.ids.join(', ')}`);
        const d = diffMapping(mapping, mod.options, feat.options);
        const line = (label, arr, fix) => arr.length && warn(`${label}: ${arr.join(', ')}`, fix);
        line('ClickUp Module options missing from mapping.json', d.modulesNotInMapping, 'add them to mapping.json (empty list = manual needed)');
        line('mapping.json modules missing from the ClickUp Module field', d.modulesNotInClickUp, 'add the option in ClickUp or remove it from mapping.json');
        line('ClickUp Feature options missing from mapping.json', d.featuresNotInMapping, 'add them under the right module in mapping.json');
        line('mapping.json features missing from the ClickUp Feature field', d.featuresNotInClickUp, 'add the option in ClickUp or remove it from mapping.json');
        if (!Object.values(d).some((a) => a.length)) ok('ClickUp dropdown options and mapping.json names match');
      }
      const listId = task.list?.id;
      if (listId) {
        const list = await getList(listId);
        const names = (list.statuses || []).map((s) => s.status.toLowerCase());
        for (const [k, def] of [['STATUS_PASSED', 'QA Passed'], ['STATUS_FAILED', 'QA Failed'], ['STATUS_BLOCKED', '']]) {
          const want = process.env[k] || def;
          if (!want) continue;
          names.includes(want.toLowerCase()) ? ok(`${k} "${want}" exists as a status on this card's list`) : warn(`${k} "${want}" is not a status on this card's list`, `create that status or change ${k} (valid: ${names.join(', ') || 'unknown'})`);
        }
      }
    }
    if (process.env.CLICKUP_BUG_LIST_ID && !placeholder(process.env.CLICKUP_BUG_LIST_ID)) {
      try {
        await getList(process.env.CLICKUP_BUG_LIST_ID);
        ok('CLICKUP_BUG_LIST_ID is a valid list');
      } catch (e) {
        warn(`CLICKUP_BUG_LIST_ID did not work (${e.message.slice(0, 60)})`, 'copy the list id again, or leave it empty and skip --create-bug');
      }
    } else warn('CLICKUP_BUG_LIST_ID not set (only needed for --create-bug)');
  } catch (e) {
    fail(`ClickUp call failed: ${e.message.slice(0, 140)}`, 'check CLICKUP_TOKEN and the card id');
  }
}

// 5. Claude agent
section('5. Claude agent');
try {
  const mcp = JSON.parse(readFileSync('.mcp.json', 'utf8')).mcpServers || {};
  ['playwright', 'clickup'].every((k) => mcp[k]) ? ok('.mcp.json has playwright and clickup') : fail('.mcp.json is missing playwright or clickup', 'restore .mcp.json from the zip');
} catch {
  fail('.mcp.json is missing or invalid', 'restore .mcp.json from the zip');
}
try {
  const st = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
  JSON.stringify(st.hooks || {}).includes('guard-hook.mjs') ? ok('guard hook is registered in .claude/settings.json') : fail('guard hook is not registered', 'restore .claude/settings.json from the zip');
} catch {
  fail('.claude/settings.json is missing or invalid', 'restore it from the zip');
}
const h = spawnSync(process.execPath, ['scripts/guard-hook.mjs'], { input: JSON.stringify({ tool_name: 'mcp__playwright__browser_navigate', tool_input: { url: 'https://control.msg91.com/' } }), encoding: 'utf8', env: { ...process.env, ALLOWED_HOSTS: 'localhost' } });
h.status === 2 ? ok('guard hook blocks a live-site request (exit 2)') : fail('guard hook did NOT block a live-site request', 'do not run the agent until this is fixed');
warn('guard not yet confirmed inside a real Claude Code session', 'in `claude` run /hooks (hook listed), /mcp (clickup logged in), then compare the ClickUp tool names with config/guard.json');

// 6. Cannot be checked by code
section('6. Open questions for the dev team (no code can answer these)');
for (const q of ['Dev base URL, and can GitHub Actions reach it (VPN / IP allowlist)?', 'Does dev send REAL SMS / WhatsApp / email, or are messages simulated?', 'How do we add wallet credit to the automation account on dev?', 'How can a test read the OTP / email it triggered (test inbox, number, log API)?']) warn(q);

console.log(`\n${paint(1, 'Summary')}: ${paint(32, `${counts.ok} ok`)}, ${paint(33, `${counts.warn} to-do / warnings`)}, ${paint(31, `${counts.fail} to fix`)}`);
console.log(firstFix ? `${paint(1, 'Fix this first')}: ${firstFix}\n` : `${paint(1, 'Nothing blocking.')} Work through the warnings in order.\n`);
process.exit(counts.fail ? 1 : 0);
