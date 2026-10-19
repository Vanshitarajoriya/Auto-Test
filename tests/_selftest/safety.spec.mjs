// SELF-TESTS for the guardrails themselves. They need no network and no MSG91 account.
import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREFIX } from '../../src/config.mjs';
import { assertAllowedUrl, assertTagged, taggedName, safeDelete, Cleanup, SpendCap, assertTestRecipient, SafetyError } from '../../src/safety.mjs';
import { readFieldValues, addComment, fieldOptions } from '../../src/clickup.mjs';
import { lookupTests, diffMapping } from '../../src/mapping.mjs';
import { judge, canaryHealthy, collectTests } from '../../src/results.mjs';
import { decide } from '../../src/guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dev = { allowedHosts: ['dev.example.test'] };

test('SAFE-001: taggedName always adds the AUTO_TEST_ prefix (never doubles it)', () => {
  expect(taggedName('otp check').startsWith(PREFIX)).toBe(true);
  expect(taggedName('AUTO_TEST_already').match(/AUTO_TEST_/g)).toHaveLength(1);
  expect(taggedName('x', { now: new Date(2026, 9, 19), rand: () => 0.5 })).toBe('AUTO_TEST_x_1019_i');
});

test('SAFE-002: delete refuses untagged names and never calls the deleter', async () => {
  let called = false;
  await expect(safeDelete('real_customer_template', async () => (called = true))).rejects.toThrow(SafetyError);
  expect(called).toBe(false);
  await expect(safeDelete('AUTO_TEST_x', async () => 'ok')).resolves.toBe('ok');
});

test('SAFE-003: only allowlisted dev hosts pass; live hosts are refused even if allowlisted', () => {
  expect(() => assertAllowedUrl('https://dev.example.test/api', dev)).not.toThrow();
  expect(() => assertAllowedUrl('https://control.msg91.com/api', dev)).toThrow(/LIVE/);
  expect(() => assertAllowedUrl('https://control.msg91.com/api', { allowedHosts: ['control.msg91.com'] })).toThrow(/LIVE/);
  expect(() => assertAllowedUrl('https://other.example.test', dev)).toThrow(/allowlist/);
  expect(() => assertAllowedUrl('ftp://dev.example.test', dev)).toThrow(/protocol/);
  expect(() => assertAllowedUrl('not a url', dev)).toThrow(/valid URL/);
});

test('SAFE-004: spend cap stops a run at the limit', () => {
  const cap = new SpendCap(3);
  cap.spend(2);
  cap.spend(1);
  expect(() => cap.spend(1)).toThrow(/spend cap reached/);
  expect(cap.used).toBe(3);
});

test('SAFE-005: cleanup runs every item even if one fails, and untagged items cannot be registered', async () => {
  const c = new Cleanup();
  const order = [];
  c.add('AUTO_TEST_a', async () => order.push('a'));
  c.add('AUTO_TEST_b', async () => { throw new Error('boom'); });
  c.add('AUTO_TEST_c', async () => order.push('c'));
  expect(() => c.add('customer_data', async () => {})).toThrow(SafetyError);
  const errors = await c.runAll();
  expect(order).toEqual(['c', 'a']);
  expect(errors).toHaveLength(1);
});

test('SAFE-006: messages may only go to TEST_RECIPIENTS', () => {
  expect(assertTestRecipient('9990001111', { recipients: ['9990001111'] })).toBe('9990001111');
  expect(() => assertTestRecipient('9876543210', { recipients: ['9990001111'] })).toThrow(SafetyError);
  expect(() => assertTestRecipient(undefined, { recipients: [] })).toThrow(SafetyError);
});

test('SAFE-007: ClickUp custom fields are read as labels (option id, orderindex, name, multi, text)', () => {
  const task = {
    custom_fields: [
      { name: 'Module', type: 'drop_down', value: 1, type_config: { options: [{ id: 'a', name: 'OTP', orderindex: 0 }, { id: 'b', name: 'WhatsApp', orderindex: 1 }] } },
      { name: 'Feature', type: 'labels', value: ['x', 'y'], type_config: { options: [{ id: 'x', label: 'Templates' }, { id: 'y', label: 'Groups' }] } },
      { name: 'Other', type: 'drop_down', value: 'a', type_config: { options: [{ id: 'a', name: 'ById', orderindex: 7 }] } },
      { name: 'Free', type: 'short_text', value: 'Send, Verify' },
      { name: 'Empty', type: 'drop_down', value: null },
    ],
  };
  expect(readFieldValues(task, 'module')).toEqual(['WhatsApp']);
  expect(readFieldValues(task, 'Feature')).toEqual(['Templates', 'Groups']);
  expect(readFieldValues(task, 'Other')).toEqual(['ById']);
  expect(readFieldValues(task, 'Free')).toEqual(['Send', 'Verify']);
  expect(readFieldValues(task, 'Empty')).toEqual([]);
  expect(readFieldValues(task, 'Missing')).toEqual([]);
});

test('SAFE-008: mapping lookup: union of features, missing fields, unmapped features', () => {
  const m = { OTP: { Send: ['OTP-1'], Verify: ['OTP-2', 'OTP-3'], Resend: [] } };
  expect(lookupTests(m, 'otp', ['send', 'Verify'])).toMatchObject({ status: 'ok', ids: ['OTP-1', 'OTP-2', 'OTP-3'], unmappedFeatures: [] });
  expect(lookupTests(m, 'OTP', ['Send', 'Resend'])).toMatchObject({ status: 'ok', ids: ['OTP-1'], unmappedFeatures: ['Resend'] });
  expect(lookupTests(m, 'OTP', ['Resend']).status).toBe('manual-needed');
  expect(lookupTests(m, 'Nope', ['Send']).status).toBe('manual-needed');
  expect(lookupTests(m, undefined, ['Send']).status).toBe('needs-fields');
  expect(lookupTests(m, 'OTP', []).status).toBe('needs-fields');
});

test('SAFE-009: Claude guard hook decisions', () => {
  const o = { projectDir: '/proj', allowedHosts: ['dev.example.test'] };
  const d = (tool_name, tool_input) => decide({ tool_name, tool_input }, o);
  expect(d('mcp__playwright__browser_navigate', { url: 'https://dev.example.test/login' }).allow).toBe(true);
  expect(d('mcp__playwright__browser_navigate', { url: 'https://control.msg91.com' }).allow).toBe(false);
  expect(d('mcp__playwright__browser_run_code_unsafe', {}).allow).toBe(false);
  expect(d('mcp__playwright__browser_click', {}).allow).toBe(true);
  expect(d('mcp__clickup__clickup_get_task', {}).allow).toBe(true);
  expect(d('mcp__clickup__clickup_create_task_comment', {}).allow).toBe(true);
  expect(d('mcp__clickup__clickup_delete_task', {}).allow).toBe(false);
  expect(d('mcp__clickup__clickup_update_task', {}).allow).toBe(false);
  expect(d('mcp__clickup__clickup_create_task', {}).allow).toBe(false);
  expect(d('Write', { file_path: '/proj/tests/otp/api/OTP-1.spec.mjs' }).allow).toBe(true);
  expect(d('Write', { file_path: '/proj/drafts/x.json' }).allow).toBe(true);
  expect(d('Write', { file_path: '/proj/demo/tests/otp/x.spec.mjs' }).allow).toBe(true);
  expect(d('Write', { file_path: '/proj/demo/run-demo.mjs' }).allow).toBe(false);
  expect(d('Write', { file_path: '/proj/src/safety.mjs' }).allow).toBe(false);
  expect(d('Edit', { file_path: '/proj/mapping.json' }).allow).toBe(false);
  expect(d('Edit', { file_path: '/proj/tests/_canary/canary.spec.mjs' }).allow).toBe(false);
  expect(d('Write', { file_path: '/etc/passwd' }).allow).toBe(false);
  expect(d('Read', { file_path: '/proj/.env' }).allow).toBe(false);
  expect(d('Read', { file_path: '/proj/.env.example' }).allow).toBe(true);
  expect(d('Bash', { command: 'curl https://control.msg91.com/api' }).allow).toBe(false);
  expect(d('Bash', { command: 'cat .env' }).allow).toBe(false);
  expect(d('Bash', { command: 'git push origin main' }).allow).toBe(false);
  expect(d('Bash', { command: 'git push origin qa/OTP-014' }).allow).toBe(true);
  expect(d('Bash', { command: "sed -i 's/x/y/' src/safety.mjs" }).allow).toBe(false);
  expect(d('Bash', { command: 'npx playwright test tests/otp' }).allow).toBe(true);
});

test('SAFE-010: hook script speaks the Claude Code contract (exit 2 + stderr blocks, exit 0 allows)', () => {
  const run = (payload) =>
    spawnSync('node', [path.join(root, 'scripts/guard-hook.mjs')], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      cwd: mkdtempSync(path.join(tmpdir(), 'hook-')),
      env: { ...process.env, ALLOWED_HOSTS: 'dev.example.test', CLAUDE_PROJECT_DIR: root },
    });
  const blocked = run({ tool_name: 'mcp__playwright__browser_navigate', tool_input: { url: 'https://control.msg91.com' } });
  expect(blocked.status).toBe(2);
  expect(blocked.stderr).toContain('LIVE');
  expect(run({ tool_name: 'mcp__playwright__browser_navigate', tool_input: { url: 'https://dev.example.test' } }).status).toBe(0);
  expect(spawnSync('node', [path.join(root, 'scripts/guard-hook.mjs')], { input: 'not json', encoding: 'utf8' }).status).toBe(2);
});

test('SAFE-011: verdict rules (pass, fail, flaky, skipped, missing) and canary health', () => {
  const t = (id, status) => ({ id, title: `${id}: x`, status, error: status === 'unexpected' ? 'boom' : '' });
  expect(judge([t('A-1', 'expected'), t('A-2', 'expected')], ['A-1', 'A-2']).verdict).toBe('QA Passed');
  expect(judge([t('A-1', 'expected'), t('A-2', 'unexpected')], ['A-1', 'A-2']).verdict).toBe('QA Failed');
  const flaky = judge([t('A-1', 'flaky')], ['A-1']);
  expect(flaky.verdict).toBe('QA Passed');
  expect(flaky.flaky).toHaveLength(1);
  expect(judge([t('A-1', 'skipped')], ['A-1']).verdict).toBe('Blocked: environment');
  expect(judge([t('A-1', 'expected')], ['A-1', 'A-9']).verdict).toBe('Mapping error');
  expect(judge([t('A-1', 'unexpected'), t('A-2', 'skipped')], ['A-1', 'A-2']).verdict).toBe('QA Failed');
  expect(canaryHealthy([t('CANARY-1', 'unexpected'), t('CANARY-2', 'unexpected'), t('CANARY-3', 'unexpected')])).toBe(true);
  expect(canaryHealthy([t('CANARY-1', 'unexpected'), t('CANARY-2', 'expected'), t('CANARY-3', 'unexpected')])).toBe(false);
  expect(canaryHealthy([])).toBe(false);
  const report = { suites: [{ specs: [{ title: 'A-1: x', tests: [{ status: 'expected', results: [] }] }], suites: [{ specs: [{ title: 'A-2: y', tests: [{ status: 'unexpected', results: [{ error: { message: '\u001b[31mExpected 1\u001b[39m' } }] }] }] }] }] };
  const tests = collectTests(report);
  expect(tests.map((x) => x.id)).toEqual(['A-1', 'A-2']);
  expect(tests[1].error).toBe('Expected 1');
});

test('SAFE-012: the verdict path contains no AI SDK (runner/, src/ and server/ never import one)', () => {
  const banned = /anthropic|openai|claude-agent-sdk|gtwy|generative-?ai/i;
  const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? files(path.join(dir, f)) : [path.join(dir, f)]));
  const offenders = [...files(path.join(root, "runner")), ...files(path.join(root, "src")), ...files(path.join(root, "server"))].filter((f) => banned.test(readFileSync(f, 'utf8')));
  expect(offenders).toEqual([]);
});

test('SAFE-013: ClickUp calls survive a dropped connection (stale keep-alive) by retrying', async () => {
  let hits = 0;
  const server = createServer((req, res) => {
    hits++;
    if (hits === 1) return req.socket.destroy(); // simulate a socket the server already closed
    res.setHeader('content-type', 'application/json');
    res.end('{"ok":true}');
  });
  await new Promise((r) => server.listen(0, r));
  const saved = { base: process.env.CLICKUP_API_BASE, token: process.env.CLICKUP_TOKEN };
  process.env.CLICKUP_API_BASE = `http://localhost:${server.address().port}/api/v2`;
  process.env.CLICKUP_TOKEN = 't';
  try {
    await expect(addComment('abc', 'hello')).resolves.toEqual({ ok: true });
    expect(hits).toBe(2);
  } finally {
    server.close();
    process.env.CLICKUP_API_BASE = saved.base;
    process.env.CLICKUP_TOKEN = saved.token;
    if (saved.base === undefined) delete process.env.CLICKUP_API_BASE;
    if (saved.token === undefined) delete process.env.CLICKUP_TOKEN;
  }
});

test('SAFE-014: doctor helpers: field presence/options and ClickUp-vs-mapping name differences', () => {
  const task = { custom_fields: [{ name: 'Module', type: 'drop_down', value: null, type_config: { options: [{ name: 'OTP' }, { name: 'Email' }] } }, { name: 'Feature', type: 'labels', type_config: { options: [{ label: 'Send' }, { label: 'Verify' }] } }] };
  expect(fieldOptions(task, 'module')).toEqual({ exists: true, type: 'drop_down', options: ['OTP', 'Email'] });
  expect(fieldOptions(task, 'Missing')).toEqual({ exists: false, options: [] });
  const mapping = { Platform: { Safety: ['SAFE-1'] }, OTP: { Send: [], Resend: [] }, SMS: { Send: [] } };
  expect(diffMapping(mapping, ['OTP', 'Email'], ['send', 'Verify'])).toEqual({
    modulesNotInMapping: ['Email'],
    modulesNotInClickUp: ['SMS'],
    featuresNotInMapping: ['Verify'],
    featuresNotInClickUp: ['Resend'],
  });
});
