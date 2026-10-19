// DEMO tests against the FAKE API (demo/API.md). Same rules as real tests: fixtures, tagged names, real assertions.
import { test, expect, taggedName, assertTestRecipient } from '../../../src/fixtures.mjs';
import { createApi } from '../../../src/api.mjs';

const recipient = () => assertTestRecipient(process.env.TEST_RECIPIENTS.split(',')[0]);

async function sendOtp(api, extra = {}) {
  const res = await api.post('/demo/otp/send', { data: { mobile: recipient(), ...extra }, sends: 1 });
  return { res, body: await res.json() };
}
const otpOnPhone = async (api) => (await (await api.get(`/demo/inbox?mobile=${recipient()}`)).json()).otp;

test('DEMO-001: sending an OTP succeeds, returns a request id, and the log shows it @otp @api @smoke', async ({ api }) => {
  const { res, body } = await sendOtp(api);
  expect(res.status()).toBe(200);
  expect(body.type).toBe('success');
  expect(body.request_id).toBeTruthy();
  const logs = await (await api.get(`/demo/logs?request_id=${body.request_id}`)).json();
  expect(logs.logs.map((l) => l.event)).toContain('sent');
});

test('DEMO-002: the correct OTP verifies and the log shows it @otp @api @smoke', async ({ api }) => {
  const { body } = await sendOtp(api);
  const res = await api.post('/demo/otp/verify', { data: { request_id: body.request_id, otp: await otpOnPhone(api) } });
  expect(res.status()).toBe(200);
  expect((await res.json()).type).toBe('success');
  const logs = await (await api.get(`/demo/logs?request_id=${body.request_id}`)).json();
  expect(logs.logs.map((l) => l.event)).toContain('verified');
});

test('DEMO-003: a wrong OTP is rejected, and the real OTP still works afterwards @otp @api @regression', async ({ api }) => {
  const { body } = await sendOtp(api);
  const otp = await otpOnPhone(api);
  const wrong = otp.slice(0, 5) + ((Number(otp[5]) + 1) % 10);
  const bad = await api.post('/demo/otp/verify', { data: { request_id: body.request_id, otp: wrong } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).code).toBe('invalid_otp');
  const good = await api.post('/demo/otp/verify', { data: { request_id: body.request_id, otp } });
  expect(good.status()).toBe(200);
});

test('DEMO-004: a wrong authkey is rejected @otp @api @regression', async ({ request }) => {
  const stranger = createApi(request, { authkey: 'not-our-key' });
  const res = await stranger.post('/demo/otp/send', { data: { mobile: recipient() } });
  expect(res.status()).toBe(401);
  expect((await res.json()).code).toBe('auth_failure');
});

test('DEMO-005: an expired OTP is rejected @otp @api @regression', async ({ api }) => {
  const { body } = await sendOtp(api, { expiry_ms: 300 });
  const otp = await otpOnPhone(api);
  await new Promise((r) => setTimeout(r, 600));
  const res = await api.post('/demo/otp/verify', { data: { request_id: body.request_id, otp } });
  expect(res.status()).toBe(400);
  expect((await res.json()).code).toBe('otp_expired');
});

test('DEMO-007: a template can be created, and the AUTO_TEST_ prefix + teardown remove it afterwards @otp @api @regression', async ({ api, cleanup }) => {
  const name = taggedName('welcome_otp');
  expect(name.startsWith('AUTO_TEST_')).toBe(true);
  const created = await api.post('/demo/templates', { data: { name, body: 'Your OTP is ##OTP##' } });
  expect(created.status()).toBe(201);
  cleanup.add(name, () => api.deleteTagged(`/demo/templates/${encodeURIComponent(name)}`, name)); // removed after the test, pass or fail
  const list = await (await api.get('/demo/templates')).json();
  expect(list.templates).toContain(name);
});
