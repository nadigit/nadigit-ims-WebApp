import { test as setup, expect, Page } from '@playwright/test';
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

  // Pin the language into the saved state. The interaction specs find controls by their visible
  // label ("New", "Save", "Yes"), so the suite has to know which of the four bundles is loaded.
  // 'en' is already the default, but a default is a thing that changes; storageState carries
  // localStorage, so setting it here fixes it for every spec that reuses the session.
  await page.evaluate(() => localStorage.setItem('preferredLanguage', 'en'));

  // Retire the welcome tour before any spec runs. driver.js draws a full-viewport SVG overlay to
  // spotlight what it is pointing at, and that overlay swallows pointer events — every click in
  // the suite would land on it instead of the control underneath. TourService keys the flag per
  // user (ims_tour_seen_<tourId>_<username>), so it has to be set for the account we signed in as.
  //
  // This means the suite never exercises the tour itself. That is the right trade for specs about
  // everything else, but the tour deserves a spec of its own that lets it open and walks it.
  await page.evaluate((user) => {
    localStorage.setItem(`ims_tour_seen_welcome_${user}`, 'true');
  }, USERNAME);

  await completeFirstRunSetup(page);

  await page.context().storageState({ path: STATE });
});

/**
 * Clears the first-run gate, if the install still has it.
 *
 * A fresh database has no business activity profile, and BusinessActivityProfileGuard bounces
 * every route to Global Settings until one is chosen. The suite navigates straight to deep pages,
 * so without this every spec would quietly find itself on the settings screen and fail looking for
 * controls that are on a different page entirely.
 *
 * Server-side state, not browser state: it survives across runs, and `e2e-stack.ps1 reset` clears
 * it along with the databases. Hence the check rather than doing it unconditionally.
 *
 * GENERAL_RETAIL on purpose — it is the profile that turns on the fewest speciality behaviours
 * (no pharmacy batch/expiry requirements), so specs exercise the ordinary path.
 */
async function completeFirstRunSetup(page: Page): Promise<void> {
  // Straight to the setting rather than tripping the guard and following its redirect: the guard
  // decides asynchronously and swallows its own errors, so right after sign-in it may let a page
  // through that it would bounce a moment later. Reading the control itself is the only answer
  // that does not depend on that timing.
  await page.goto('/webconsole/administration/settings?businessProfile=1');
  await page.waitForLoadState('networkidle');

  // Click the component rather than the id: `inputId` lands on whichever inner element PrimeNG
  // considers focusable, and which one that is has changed between majors.
  const profile = page.locator('p-dropdown:has(#businessActivityProfile)');
  await profile.waitFor({ state: 'visible', timeout: 30_000 });

  // Already chosen on this install: nothing to do, and re-saving would raise the "are you sure
  // you want to change profile" confirmation this setup has no business answering.
  if (!/select/i.test(((await profile.innerText()) ?? '').trim())) {
    return;
  }

  await profile.click();
  await page.getByRole('option', { name: 'General retail' }).click();
  await page.getByRole('button', { name: 'Save profile' }).click();

  // Saved server-side, not just picked in the form.
  await expect(page.getByRole('alert').filter({ hasText: /updated/i }).first()).toBeVisible({
    timeout: 30_000,
  });
}
