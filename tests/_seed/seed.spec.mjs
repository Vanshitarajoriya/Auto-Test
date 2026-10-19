// SEED + login for UI work. Configured by env (see .env.example), not by editing code:
//   LOGIN_PATH, EMAIL_SELECTOR, PASSWORD_SELECTOR, SUBMIT_SELECTOR, LOGGED_IN_SELECTOR, TEST_EMAIL, TEST_PASSWORD
// Run once:  npm run seed   -> logs in as the automation account and saves the session to .auth/state.json,
// which UI tests reuse. Playwright's planner/generator agents also start from this state.
// NOT RUN WHERE IT WAS WRITTEN (no browser available): expect to adjust the selectors on the first try.
import { test, expect } from '@playwright/test';
import { assertAllowedUrl } from '../../src/safety.mjs';

test('SEED-001: log in as the automation account', async ({ page }) => {
  const { DEV_URL, TEST_EMAIL, TEST_PASSWORD, LOGGED_IN_SELECTOR } = process.env;
  test.skip(!DEV_URL || !TEST_EMAIL || !TEST_PASSWORD, 'set DEV_URL, TEST_EMAIL and TEST_PASSWORD first');
  const url = new URL(process.env.LOGIN_PATH || '/login', DEV_URL).toString();
  assertAllowedUrl(url); // dev only, live hosts refused

  await page.goto(url);
  await page.locator(process.env.EMAIL_SELECTOR || 'input[type=email]').fill(TEST_EMAIL);
  await page.locator(process.env.PASSWORD_SELECTOR || 'input[type=password]').fill(TEST_PASSWORD);
  await page.locator(process.env.SUBMIT_SELECTOR || 'button[type=submit]').click();

  if (LOGGED_IN_SELECTOR) await expect(page.locator(LOGGED_IN_SELECTOR)).toBeVisible({ timeout: 30_000 });
  else await expect(page).not.toHaveURL(/login/i, { timeout: 30_000 });

  await page.context().storageState({ path: '.auth/state.json' });
});
