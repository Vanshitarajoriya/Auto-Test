// REFERENCE answer for the live Claude step ("resend must invalidate the previous OTP").
// Not matched by any project. The import path below is the one it needs AFTER it is copied. If the live step goes wrong, copy this to demo/tests/otp/ and add "DEMO-006" to
// OTP > Resend in demo/mapping.demo.json.
import { test, expect, assertTestRecipient } from '../../../src/fixtures.mjs';

test('DEMO-006: resending invalidates the previous OTP; only the new one verifies @otp @api @regression', async ({ api }) => {
  const mobile = assertTestRecipient(process.env.TEST_RECIPIENTS.split(',')[0]);
  const sent = await (await api.post('/demo/otp/send', { data: { mobile }, sends: 1 })).json();
  const first = (await (await api.get(`/demo/inbox?mobile=${mobile}`)).json()).otp;

  const resend = await api.post('/demo/otp/resend', { data: { request_id: sent.request_id }, sends: 1 });
  expect(resend.status()).toBe(200);
  const second = (await (await api.get(`/demo/inbox?mobile=${mobile}`)).json()).otp;
  expect(second).not.toBe(first);

  const old = await api.post('/demo/otp/verify', { data: { request_id: sent.request_id, otp: first } });
  expect(old.status()).toBe(400);
  expect((await old.json()).code).toBe('invalid_otp');

  const fresh = await api.post('/demo/otp/verify', { data: { request_id: sent.request_id, otp: second } });
  expect(fresh.status()).toBe(200);
});
