import { Page, TestInfo, expect } from '@playwright/test';

/**
 * What "this page still works" means for a smoke suite.
 *
 * Deliberately not assertions about markup. The upgrade this suite exists to protect renames
 * PrimeNG components and rewrites their theming, so a test pinned to `.p-datatable` would fail on
 * a change that is entirely intended.
 *
 * Nor console errors. The console has legitimate noise: the app boots, fires its first requests,
 * and only then completes the Keycloak round trip, so the discarded pre-redirect page logs a
 * handful of 401s every single time. Gating on that produces a suite nobody trusts.
 *
 * What is left is what actually distinguishes a working page from a broken one: it raises no
 * uncaught exception, and the server does not answer 5xx. Console output is attached to the test
 * for reading, never for failing.
 */
export interface PageProblems {
  consoleErrors: string[];
  pageErrors: string[];
  serverErrors: string[];
}

/** Starts collecting. Call before navigating. */
export function watchForProblems(page: Page): PageProblems {
  const problems: PageProblems = { consoleErrors: [], pageErrors: [], serverErrors: [] };

  page.on('console', (message) => {
    if (message.type() === 'error') problems.consoleErrors.push(message.text());
  });

  page.on('pageerror', (error) => problems.pageErrors.push(error.message));

  page.on('response', (response) => {
    if (response.status() >= 500) {
      problems.serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  return problems;
}

/** Fails with everything that went wrong at once, rather than the first thing. */
export async function assertHealthy(
  problems: PageProblems,
  where: string,
  testInfo?: TestInfo,
): Promise<void> {
  if (testInfo && problems.consoleErrors.length) {
    await testInfo.attach(`${where} console`, {
      body: problems.consoleErrors.join('\n'),
      contentType: 'text/plain',
    });
  }

  const complaints: string[] = [];
  if (problems.pageErrors.length) {
    complaints.push(`uncaught exceptions:\n  - ${problems.pageErrors.join('\n  - ')}`);
  }
  if (problems.serverErrors.length) {
    complaints.push(`server errors:\n  - ${problems.serverErrors.join('\n  - ')}`);
  }
  expect(complaints.join('\n'), `${where} reported problems`).toBe('');
}

/** Navigates and waits for the shell, so a caller can then assert on the page's own content. */
export async function visit(page: Page, route: string): Promise<void> {
  await page.goto(`/webconsole/${route}`.replace(/\/+$/, '/'));
  await expect(page.locator('.layout-topbar')).toBeVisible();
  // Angular resolves the lazy route and its first data call before anything meaningful is drawn.
  await page.waitForLoadState('networkidle');
}

/** Screenshot helper for the visual pass during the PrimeNG theming migration. */
export async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}
