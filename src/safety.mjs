// Safety rules enforced in CODE (not in prompts). Every test goes through these helpers.
import { PREFIX, LIVE_HOSTS, defaultAllowedHosts, list, MAX_MESSAGES_PER_RUN } from './config.mjs';

export class SafetyError extends Error {
  constructor(msg) {
    super(`SAFETY BLOCK: ${msg}`);
    this.name = 'SafetyError';
  }
}

/** Only dev hosts. Live hosts are refused even if allowlisted. */
export function assertAllowedUrl(url, { allowedHosts = defaultAllowedHosts() } = {}) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new SafetyError(`not a valid URL: ${url}`);
  }
  if (!['http:', 'https:'].includes(u.protocol)) throw new SafetyError(`protocol not allowed: ${u.protocol}`);
  const host = u.hostname.toLowerCase();
  if (LIVE_HOSTS.includes(host)) throw new SafetyError(`${host} is a LIVE host`);
  if (!allowedHosts.includes(host)) {
    throw new SafetyError(`${host} is not in the dev allowlist (${allowedHosts.join(', ') || 'empty'})`);
  }
  return u;
}

export const isTagged = (name) => typeof name === 'string' && name.startsWith(PREFIX);

export function assertTagged(name) {
  if (!isTagged(name)) throw new SafetyError(`refusing to touch "${name}": name does not start with ${PREFIX}`);
  return name;
}

/** The ONLY way tests should name things they create: AUTO_TEST_<name>_<MMDD>_<rand>. */
export function taggedName(base, { now = new Date(), rand = Math.random } = {}) {
  const clean = String(base).replace(new RegExp(`^${PREFIX}`), '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40);
  const stamp = String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  return `${PREFIX}${clean}_${stamp}_${rand().toString(36).slice(2, 6)}`;
}

/** Delete only runs for tagged names. */
export async function safeDelete(name, deleteFn) {
  assertTagged(name);
  return deleteFn();
}

/** Teardown stack: register what you create; everything is removed at the end, even if the test failed. */
export class Cleanup {
  #items = [];
  add(name, fn) {
    assertTagged(name); // registering an untagged item fails immediately
    this.#items.push({ name, fn });
  }
  async runAll() {
    const errors = [];
    for (const { name, fn } of [...this.#items].reverse()) {
      try {
        await safeDelete(name, fn);
      } catch (e) {
        errors.push(`${name}: ${e.message}`);
      }
    }
    this.#items = [];
    return errors;
  }
}

/** Max messages per run (per worker process; keep WORKERS=1 for sending tests). */
export class SpendCap {
  #used = 0;
  constructor(max = MAX_MESSAGES_PER_RUN) {
    this.max = max;
  }
  spend(n = 1) {
    if (this.#used + n > this.max) {
      throw new SafetyError(`spend cap reached: ${this.#used}/${this.max} messages already used in this run`);
    }
    this.#used += n;
    return this.#used;
  }
  get used() {
    return this.#used;
  }
}

/** Messages may only go to our own test numbers / inboxes. */
export function assertTestRecipient(value, { recipients = list(process.env.TEST_RECIPIENTS) } = {}) {
  if (!recipients.includes(String(value))) throw new SafetyError(`"${value}" is not in TEST_RECIPIENTS`);
  return value;
}
