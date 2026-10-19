// Thin API client for tests. Every call is URL-checked; deletes need a tagged name; sends count against the cap.
import { assertAllowedUrl, assertTagged, SpendCap, SafetyError } from './safety.mjs';

export function createApi(
  request,
  {
    baseUrl = process.env.DEV_URL,
    authkey = process.env.MSG91_AUTHKEY,
    authHeader = process.env.AUTH_HEADER || 'authkey',
    cap = new SpendCap(),
  } = {},
) {
  if (!baseUrl) throw new SafetyError('DEV_URL is not set');

  const full = (path) => {
    const url = new URL(path, baseUrl).toString(); // an absolute URL in `path` overrides baseUrl and is then blocked below
    assertAllowedUrl(url);
    return url;
  };
  const headers = (extra = {}) => ({
    'content-type': 'application/json',
    ...(authkey ? { [authHeader]: authkey } : {}),
    ...extra,
  });
  // `sends` = how many messages this call will send (counted against MAX_MESSAGES_PER_RUN).
  const call = (method) => (path, { data, params, headers: h, sends = 0 } = {}) => {
    if (sends) cap.spend(sends);
    return request[method](full(path), { data, params, headers: headers(h) });
  };

  return {
    cap,
    get: call('get'),
    post: call('post'),
    put: call('put'),
    patch: call('patch'),
    deleteTagged: (path, name, opts = {}) => {
      assertTagged(name);
      return call('delete')(path, opts);
    },
  };
}
