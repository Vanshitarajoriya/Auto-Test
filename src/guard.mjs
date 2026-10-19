// Decision logic for the Claude Code PreToolUse hook. Kept here (not in the hook script) so it can be unit-tested.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LIVE_HOSTS } from './config.mjs';
import { assertAllowedUrl } from './safety.mjs';

export const loadRules = () => JSON.parse(readFileSync(new URL('../config/guard.json', import.meta.url), 'utf8'));
const allow = () => ({ allow: true });
const deny = (reason) => ({ allow: false, reason: `BLOCKED by QA guard: ${reason}` });
const re = (s) => new RegExp(s, 'i');

export function decide(input, { projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd(), allowedHosts, rules = loadRules() } = {}) {
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};

  // Browser: dev hosts only, and no tools that run arbitrary code (they would bypass the URL check).
  if (/^mcp__playwright[\w-]*__/.test(tool)) {
    const name = tool.replace(/^mcp__playwright[\w-]*__/, '');
    if (re(rules.blockedBrowserTools).test(name)) return deny(`${name} runs arbitrary code; ask a human to enable it`);
    if (name === 'browser_navigate') {
      try {
        assertAllowedUrl(ti.url, { allowedHosts });
      } catch (e) {
        return deny(e.message);
      }
    }
    return allow();
  }

  // ClickUp: read and comment only.
  if (tool.startsWith('mcp__clickup')) {
    const name = tool.split('__').slice(2).join('__');
    if (rules.clickup.deny.some((p) => re(p).test(name))) return deny(`ClickUp tool "${name}" can change or delete data`);
    if (rules.clickup.allow.some((p) => re(p).test(name))) return allow();
    return deny(`ClickUp tool "${name}" is not on the read/comment allowlist (tune config/guard.json)`);
  }

  // Files: the agent may write tests and drafts only. It cannot edit its own guardrails.
  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const abs = path.resolve(projectDir, ti.file_path || '');
    const rel = path.relative(projectDir, abs).split(path.sep).join('/');
    if (rel.startsWith('..')) return deny(`${rel} is outside the project`);
    if (rules.writeDenyPrefixes.some((p) => rel.startsWith(p))) return deny(`${rel} is a protected test area`);
    if (!rules.writeAllowPrefixes.some((p) => rel.startsWith(p))) return deny(`writes are allowed only under ${rules.writeAllowPrefixes.join(' or ')} (tried ${rel})`);
    return allow();
  }

  // Secrets: never read .env files.
  if (tool === 'Read' && /(^|[\\/])\.env(\.(?!example$)[\w.-]*)?$/.test(ti.file_path || '')) return deny('.env files hold secrets');

  if (tool === 'Bash') {
    const cmd = ti.command || '';
    const live = LIVE_HOSTS.find((h) => cmd.includes(h));
    if (live) return deny(`command mentions live host ${live}`);
    if (/\.env(?!\.example)\b/.test(cmd)) return deny('command touches .env');
    if (/rm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\*|\.\s|\.$)/.test(cmd)) return deny('destructive rm');
    if (/git\s+push\b.*(--force|\s-f\b)/.test(cmd) || /git\s+push\b.*\b(main|master)\b/.test(cmd)) return deny('push to a branch and open a pull request instead');
    const prot = rules.protectedPaths.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    if (new RegExp(`(>|>>|\\btee\\b|sed\\s+-i|\\bmv\\b|\\brm\\b|\\bcp\\b)[^|;&\\n]*(${prot})`).test(cmd)) {
      return deny('command looks like it edits a protected path (guards, runner, mapping, config)');
    }
  }
  return allow();
}
