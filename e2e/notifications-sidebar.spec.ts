import { expect, Page, test } from '@playwright/test';
import { visit } from './helpers/page-health';

/**
 * The side panels stay open while they are being used, and close from their backdrop.
 *
 * PrimeNG 18's Sidebar renders the panel inside its backdrop and closed on any click reaching it, so
 * "Load more" in the notifications footer closed the whole panel.
 */
async function clickBackdrop(page: Page) {
  // The left edge of the screen is backdrop: both panels open on the right.
  await page.mouse.click(20, 400);
}

test('notifications panel: load more keeps it open, the backdrop closes it', async ({ page }) => {
  await visit(page, '');
  await page.locator('.notification-button').first().click();
  const panel = page.locator('.notification-sidebar').first();
  await expect(panel).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(800);

  const loadMore = panel.locator('.notification-footer button').first();
  if (await loadMore.isEnabled()) {
    await loadMore.click();
    await page.waitForTimeout(1500);
    await expect(panel).toBeVisible();
  }
  // A click on the panel's own background keeps it open too.
  await panel.locator('.notification-footer').click({ position: { x: 4, y: 4 } });
  await page.waitForTimeout(500);
  await expect(panel).toBeVisible();

  await clickBackdrop(page);
  await expect(panel).toHaveCount(0, { timeout: 5_000 });
});

test('settings panel: clicks inside keep it open, the backdrop closes it', async ({ page }) => {
  await visit(page, '');
  await page.locator('.layout-config-button').first().click();
  const panel = page.locator('.layout-config-sidebar').first();
  await expect(panel).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(800);

  await panel.locator('.config-hero').click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(500);
  await expect(panel).toBeVisible();

  await clickBackdrop(page);
  await expect(panel).toHaveCount(0, { timeout: 5_000 });
});
