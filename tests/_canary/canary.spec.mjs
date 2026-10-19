// CANARIES: written to FAIL. The runner requires every canary to fail before it trusts any result.
// If a canary ever PASSES, the suite or a guard is broken and the card gets "Suite broken", never "QA Passed".
import { test, expect } from '@playwright/test';
import { assertAllowedUrl, safeDelete } from '../../src/safety.mjs';

test('CANARY-001: a plain wrong assertion must fail', () => {
  expect(true).toBe(false);
});

test('CANARY-002: guard must wrongly allow a live host (it must not)', () => {
  expect(() => assertAllowedUrl('https://control.msg91.com/api', { allowedHosts: ['control.msg91.com'] })).not.toThrow();
});

test('CANARY-003: guard must wrongly delete an untagged item (it must not)', async () => {
  await expect(safeDelete('a_real_customer_template', async () => 'deleted')).resolves.toBe('deleted');
});
