import { defineConfig } from '@playwright/test';
import 'dotenv/config';
import { existsSync } from 'node:fs';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 1, // one automatic retry; a test that passes on retry is flagged "flaky", never silently green
  workers: Number(process.env.WORKERS || 1), // keep 1 for message-sending tests (spend cap is per worker)
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.DEV_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'selftest', testMatch: /_selftest\/.*\.spec\.mjs$/, retries: 0 },
    { name: 'canary', testMatch: /_canary\/.*\.spec\.mjs$/, retries: 0 },
    { name: 'api', testMatch: /\/api\/.*\.spec\.mjs$/ },
    { name: 'seed', testMatch: /_seed\/.*\.spec\.mjs$/, retries: 0, use: { browserName: 'chromium' } }, // npm run seed: saves the dev login to .auth/state.json
    { name: 'ui', testMatch: /\/ui\/.*\.spec\.mjs$/, use: { browserName: 'chromium', storageState: existsSync('.auth/state.json') ? '.auth/state.json' : undefined } },
  ],
});
