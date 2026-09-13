import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke suite.
 *
 * This exists to make the Angular 17 -> 20 upgrade verifiable: 137 components behind 18 unit tests
 * cannot tell us whether a framework hop broke a page. It runs against the local stack from
 * deploy/local/e2e-stack.ps1 in the server repo, which is a real deployment on port 18080.
 *
 *   npm run e2e            headless, what CI would run
 *   npm run e2e:ui         pick and watch individual tests
 *
 * Point it elsewhere with E2E_BASE_URL, for example at the test box.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:18080';

export default defineConfig({
  testDir: './e2e',
  // The app is a heavy SPA behind a proxy; a cold lazy-loaded route can take a while on a laptop.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // One worker on purpose: a single stack with one database. Parallel specs would race over the
  // same records and fail for reasons that have nothing to do with the code under test.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    ignoreHTTPSErrors: true,
  },
  projects: [
    // Signs in once through Keycloak and saves the session; every other project reuses it, so the
    // suite pays the OIDC round trip once instead of per test.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/state.json' },
      dependencies: ['setup'],
    },
  ],
});
