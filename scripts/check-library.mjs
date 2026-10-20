#!/usr/bin/env node
// PR gate for the test library: every test has a unique "ID: title", and every ID in mapping.json exists.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import '../src/config.mjs';
import { collectTests } from '../src/results.mjs';
import { loadMapping } from '../src/mapping.mjs';

const r = spawnSync(process.execPath, [fileURLToPath(import.meta.resolve('@playwright/test/cli')), 'test', '--list', '--reporter=json'], { encoding: 'utf8', maxBuffer: 100e6 });
let tests;
try {
  tests = collectTests(JSON.parse(r.stdout));
} catch {
  console.error('Could not list tests:\n' + (r.stderr || r.stdout));
  process.exit(1);
}

const problems = [];
const counts = new Map();
for (const t of tests) {
  if (!t.id) problems.push(`title must start with "ID: " (e.g. "OTP-014: ..."): "${t.title}"`);
  else counts.set(t.id, (counts.get(t.id) || 0) + 1);
}
for (const [id, n] of counts) if (n > 1) problems.push(`duplicate test ID ${id} (${n} tests)`);

const mapping = loadMapping();
for (const [mod, features] of Object.entries(mapping)) {
  if (mod.startsWith('_')) continue;
  for (const [feat, ids] of Object.entries(features)) for (const id of ids) if (!counts.has(id)) problems.push(`mapping.json: ${mod} > ${feat} lists ${id}, but no such test exists`);
}

if (problems.length) {
  console.error(`Library check FAILED:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`Library check OK: ${tests.length} tests, ${counts.size} unique IDs, mapping.json consistent.`);
