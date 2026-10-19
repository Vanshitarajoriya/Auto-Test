// ClickUp REST v2 helpers. Used by the deterministic runner (no AI). Posting is opt-in via runner flags.
const base = () => process.env.CLICKUP_API_BASE || 'https://api.clickup.com/api/v2';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A long Playwright run can leave a keep-alive socket that the server has since closed: the next call then fails with
// "fetch failed". Retry network errors, and rate-limit / gateway errors, a couple of times.
async function send(url, init) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, init);
      if ([429, 502, 503, 504].includes(res.status) && attempt < 2) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = new Error(`${e.message}${e.cause?.code ? ` (${e.cause.code})` : ''}`);
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function req(method, path, body) {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) throw new Error('CLICKUP_TOKEN is not set');
  const res = await send(base() + path, {
    method,
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ClickUp ${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const getTask = (id) => req('GET', `/task/${encodeURIComponent(id)}`);
export const getUser = () => req('GET', '/user');
export const getList = (id) => req('GET', `/list/${encodeURIComponent(id)}`);
export const addComment = (id, text) => req('POST', `/task/${encodeURIComponent(id)}/comment`, { comment_text: text });
export const setStatus = (id, status) => req('PUT', `/task/${encodeURIComponent(id)}`, { status });
export const createTask = (listId, name, description) =>
  req('POST', `/list/${encodeURIComponent(listId)}/task`, { name, description });

/**
 * Reads a custom field as a list of labels. Handles drop_down (value = option id OR orderindex),
 * labels (array of ids) and plain text ("A, B"). Written to ClickUp's documented shape: verify on one real card.
 */
export function readFieldValues(task, fieldName) {
  const f = (task.custom_fields || []).find((x) => (x.name || '').toLowerCase() === fieldName.toLowerCase());
  if (!f || f.value === undefined || f.value === null || f.value === '') return [];
  const opts = f.type_config?.options || [];
  const label = (o) => o.name ?? o.label;
  const resolve = (v) => {
    const hit = opts.find((o) => String(o.id) === String(v)) ?? opts.find((o) => String(o.orderindex) === String(v));
    return hit ? label(hit) : typeof v === 'string' ? v : null;
  };
  return (Array.isArray(f.value) ? f.value : [f.value])
    .map(resolve)
    .filter(Boolean)
    .flatMap((s) => String(s).split(/[,;]/))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function readCardLabels(task, env = process.env) {
  const module = readFieldValues(task, env.CLICKUP_MODULE_FIELD || 'Module')[0];
  const features = readFieldValues(task, env.CLICKUP_FEATURE_FIELD || 'Feature');
  return { module, features };
}

/** Which options does a dropdown/labels field offer on this card, and does the field exist at all? */
export function fieldOptions(task, fieldName) {
  const f = (task.custom_fields || []).find((x) => (x.name || '').toLowerCase() === fieldName.toLowerCase());
  if (!f) return { exists: false, options: [] };
  return { exists: true, type: f.type, options: (f.type_config?.options || []).map((o) => o.name ?? o.label).filter(Boolean) };
}
