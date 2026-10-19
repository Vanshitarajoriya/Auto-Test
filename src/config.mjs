import 'dotenv/config';

export const PREFIX = 'AUTO_TEST_';

// Hosts that must NEVER be touched by automation, even if someone puts them in ALLOWED_HOSTS.
export const LIVE_HOSTS = ['control.msg91.com', 'api.msg91.com', 'msg91.com', 'www.msg91.com'];

export const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

/** Dev hosts automation may call. Set ALLOWED_HOSTS explicitly in CI; falls back to the DEV_URL host. */
export function defaultAllowedHosts(env = process.env) {
  const explicit = list(env.ALLOWED_HOSTS).map((h) => h.toLowerCase());
  if (explicit.length) return explicit;
  try {
    return env.DEV_URL ? [new URL(env.DEV_URL).hostname.toLowerCase()] : [];
  } catch {
    return [];
  }
}

export const MAX_MESSAGES_PER_RUN = Number(process.env.MAX_MESSAGES_PER_RUN || 20);
