// Runs before every card run. A failure here gives "Blocked: environment", never a false "Failed".
import { defaultAllowedHosts } from './config.mjs';
import { assertAllowedUrl } from './safety.mjs';

/** Add async () => ({ name, ok, detail }) checks here once dev endpoints are known: login, wallet balance, sender ID. */
export const extraChecks = [];

export async function preflight({ skipNetwork = false, env = process.env } = {}) {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail });

  add('DEV_URL is set', !!env.DEV_URL, env.DEV_URL ? '' : 'set DEV_URL in .env or CI secrets');

  if (env.DEV_URL) {
    try {
      assertAllowedUrl(env.DEV_URL, { allowedHosts: defaultAllowedHosts(env) });
      add('DEV_URL passes the dev allowlist (live hosts refused)', true);
    } catch (e) {
      add('DEV_URL passes the dev allowlist (live hosts refused)', false, e.message);
    }
    if (!env.ALLOWED_HOSTS) add('ALLOWED_HOSTS set explicitly', true, 'WARNING: derived from DEV_URL; set ALLOWED_HOSTS explicitly in CI');
  }

  if (skipNetwork) {
    add('dev is reachable', true, 'SKIPPED (--skip-network-checks): local self-test only');
  } else if (env.DEV_URL && checks.every((c) => c.ok)) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 10_000);
      const res = await fetch(env.DEV_URL, { signal: ctl.signal, redirect: 'manual' });
      clearTimeout(timer);
      add('dev is reachable', res.status < 500, `HTTP ${res.status}`);
    } catch (e) {
      add('dev is reachable', false, e.name === 'AbortError' ? 'timed out after 10s' : String(e.cause?.code || e.message));
    }
  }

  for (const fn of extraChecks) {
    try {
      checks.push(await fn());
    } catch (e) {
      add('extra check', false, e.message);
    }
  }
  return { ok: checks.every((c) => c.ok), checks };
}
