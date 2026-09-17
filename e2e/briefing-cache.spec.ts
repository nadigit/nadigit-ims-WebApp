import { expect, Page, test } from '@playwright/test';
import { visit } from './helpers/page-health';

/**
 * The dashboard briefing is not refetched on every return.
 *
 * Going back to the dashboard shows the briefing received earlier in the session at once, with no
 * "thinking" state and no request; the refresh button asks again, telling the server to recompute.
 */
const BRIEFING = /\/api\/ai\/copilot\/briefing/;

function trackBriefingRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (BRIEFING.test(r.url())) urls.push(r.url());
  });
  return urls;
}

async function goInApp(page: Page, path: string) {
  // Router navigation, as a user clicking the sidebar: a full reload would empty the session store.
  await page.evaluate((p) => {
    const link = Array.from(document.querySelectorAll('.layout-menu a')).find(
      (a) => (a.getAttribute('href') || '').replace(/\/$/, '').endsWith(p)) as HTMLAnchorElement | undefined;
    link?.click();
  }, path);
}

test('returning to the dashboard reuses the briefing; refresh asks the server again', async ({ page }) => {
  const requests = trackBriefingRequests(page);
  await visit(page, '');
  // The briefing is asked for after the dashboard's other data; on a server that has just started
  // (the first test after an upgrade) that can take longer than half a minute.
  await expect.poll(() => requests.length, { timeout: 90_000 }).toBeGreaterThanOrEqual(1);
  await expect(page.locator('.cc-briefing').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.cc-briefing--thinking')).toHaveCount(0, { timeout: 30_000 });
  const firstCount = requests.length;

  await goInApp(page, '/inventory/products');
  await page.waitForURL(/inventory\/products/, { timeout: 15_000 });
  await goInApp(page, '/webconsole');
  if (!/webconsole\/?$/.test(page.url())) {
    await page.locator('.layout-menu a', { hasText: /^\s*(Dashboard|Tableau de bord)\s*$/ }).first().click();
  }
  await page.waitForURL(/webconsole\/?$/, { timeout: 15_000 });

  // Shown straight away, never in the thinking state, and not asked for again.
  await expect(page.locator('.cc-briefing').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.cc-briefing--thinking')).toHaveCount(0);
  await page.waitForTimeout(3000);
  expect(requests.length).toBe(firstCount);

  // Refresh: a new request, with refresh=true so the server recomputes as well.
  await page.locator('button:has(.pi-refresh)').first().click();
  await expect.poll(() => requests.length, { timeout: 30_000 }).toBeGreaterThan(firstCount);
  expect(requests[requests.length - 1]).toContain('refresh=true');
});
