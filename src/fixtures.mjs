// Import { test, expect } from here (not from @playwright/test) so every test gets the safe helpers.
import { test as base, expect } from '@playwright/test';
import { createApi } from './api.mjs';
import { Cleanup, taggedName, assertTestRecipient } from './safety.mjs';

export const test = base.extend({
  // Guarded API client (dev only, delete needs tag, sends counted).
  api: async ({ request }, use) => {
    await use(createApi(request));
  },
  // Register everything you create; it is removed after the test, pass or fail.
  cleanup: async ({}, use) => {
    const c = new Cleanup();
    try {
      await use(c);
    } finally {
      const errors = await c.runAll();
      if (errors.length) console.error('CLEANUP ERRORS (nightly cleanup must retry these):\n' + errors.join('\n'));
    }
  },
});

export { expect, taggedName, assertTestRecipient };
