// TEMPLATE (never runs: _template is not matched by any project). Copy to tests/<module>/api/ or tests/<module>/ui/.
//
// Rules a reviewer checks in the pull request:
//  1. Title starts with the ID and a colon:   'OTP-014: wrong OTP shows invalid error'
//  2. Asserts the REAL business result, not just "no error" or status 200.
//  3. Uses the fixtures: api (guarded), cleanup (teardown), taggedName (AUTO_TEST_ prefix).
//  4. Shown failing once on purpose (break the expected value, see it go red, then fix it).
//  5. Messages go only to TEST_RECIPIENTS, and sends are counted: api.post(path, { data, sends: 1 }).
//  6. Has an owner and tags below.
import { test, expect, taggedName, assertTestRecipient } from '../../src/fixtures.mjs';

test.describe('OTP-000 template', () => {
  test('OTP-000: <what must be true, in plain English> @otp @api @regression', async ({ api, cleanup }) => {
    test.info().annotations.push({ type: 'owner', description: '<your name>' });

    const recipient = assertTestRecipient(process.env.TEST_RECIPIENTS?.split(',')[0]);

    // Anything you CREATE is named by taggedName() and registered for deletion:
    // const name = taggedName('otp_template');
    // const created = await api.post('/<path from module.json>', { data: { name /* ... */ } });
    // cleanup.add(name, () => api.deleteTagged('/<delete path>', name));

    // Send / act (count messages against the spend cap):
    // const res = await api.post('/<path from module.json>', { data: { /* ... */ }, sends: 1 });

    // Assert the REAL result:
    // expect(res.ok()).toBeTruthy();
    // expect((await res.json()).type).toBe('success');
    // ...then confirm downstream (logs endpoint, test inbox) that it really happened.
    expect(recipient).toBeTruthy();
  });
});
