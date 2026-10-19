#!/usr/bin/env node
// Claude Code PreToolUse hook: exit 2 = block, stderr is shown to Claude. Logs a decision trail WITHOUT tool inputs (they may hold secrets).
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { decide } from '../src/guard.mjs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.stderr.write('BLOCKED by QA guard: could not read hook input\n');
  process.exit(2);
}

const d = decide(input);
try {
  mkdirSync('results', { recursive: true });
  appendFileSync('results/agent-audit.log', JSON.stringify({ t: new Date().toISOString(), tool: input.tool_name, allow: d.allow, reason: d.allow ? undefined : d.reason }) + '\n');
} catch {
  /* logging must never break the hook */
}
if (!d.allow) {
  process.stderr.write(d.reason + '\n');
  process.exit(2);
}
process.exit(0);
