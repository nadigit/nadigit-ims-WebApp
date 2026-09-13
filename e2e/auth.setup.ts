import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const STATE = 'e2e/.auth/state.json';

const USERNAME = process.env.E2E_USERNAME ?? 'e2e';
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-Passw0rd!';

/**
 * Signs in through Keycloak once and saves the session.
 *
 * The console has no login form of its own: keycloak-js redirects to the realm, and the browser
 * comes back with an SSO cookie. Saving storage state therefore saves that cookie, and every
 * later test lands authenticated without another round trip.
 *
 * The local stack clears the bootstrap admin's forced password change (see e2e-stack.ps1), which
 * is why this does not have to drive the change-password screen. That flow deserves a test of its
 * own rather than a detour on every run.
 */
setup('sign in', async ({ page }) => {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });

  await page.goto('/webconsole/');

  // keycloak-js bounces straight to the realm's auth endpoint.
  await page.waitForURL(/\/realms\/[^/]+\/protocol\/openid-connect\/auth/, { timeout: 60_000 });

  await page.locator('#username').fill(USERNAME);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('#kc-login').click();

  // A forced password change here means the stack was brought up without e2e-stack.ps1, or the
  // realm was recreated behind its back. Say so plainly rather than timing out on a missing app.
  const passwordUpdate = page.locator('#password-new');
  await Promise.race([
    page.waitForURL('**/webconsole/**', { timeout: 60_000 }),
    passwordUpdate.waitFor({ state: 'visible', timeout: 60_000 }).then(() => {
      throw new Error(
        'Keycloak is asking for a new password. Run deploy/local/e2e-stack.ps1 up, which clears ' +
          'the forced change on the e2e account.',
      );
    }),
  ]);

  // The shell is ours; PrimeNG internals are not. Asserting on .layout-topbar keeps this working
  // across the PrimeNG majors the upgrade goes through.
  await expect(page.locator('.layout-topbar')).toBeVisible();

  await page.context().storageState({ path: STATE });
});
