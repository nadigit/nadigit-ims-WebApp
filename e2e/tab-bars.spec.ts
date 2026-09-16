import { expect, Locator, Page, test } from '@playwright/test';
import { visit } from './helpers/page-health';

/**
 * Tab bars keep their layout whichever tab component the session rendered first.
 *
 * PrimeNG 18.0.2 loads TabMenu's and Tabs' stylesheets under one name, once per session, so the second
 * component to appear lost its layout: user details after Users and Permissions drew its tabs as a
 * vertical stack. Both navigations happen in-app here, since a fresh page load hides the problem.
 */
async function expectOneRow(tabs: Locator) {
  await expect(tabs.first()).toBeVisible({ timeout: 20_000 });
  const count = await tabs.count();
  expect(count).toBeGreaterThan(1);
  const tops = new Set<number>();
  for (let i = 0; i < count; i++) {
    const box = await tabs.nth(i).boundingBox();
    if (box) tops.add(Math.round(box.y));
  }
  expect(tops.size, 'every tab on one row').toBe(1);
}

async function openFirstUserDetails(page: Page) {
  await page.locator('.p-datatable-tbody tr').first().locator('.pi-eye').first().click();
  await page.waitForURL(/administration\/users\/.+/, { timeout: 15_000 });
}

test('user details tabs stay in one row after Users and Permissions', async ({ page }) => {
  await visit(page, 'administration/users');
  await expectOneRow(page.locator('.p-tabmenu-nav .p-tabmenuitem'));
  await openFirstUserDetails(page);
  await expectOneRow(page.locator('.p-tablist-tab-list .p-tab'));
});

test('Users and Permissions tabs stay in one row after a Tabs page', async ({ page }) => {
  await visit(page, 'administration/settings');
  await expectOneRow(page.locator('.p-tablist-tab-list .p-tab'));
  await page.goBack().catch(() => {});
  // In-app navigation to Users and Permissions through the router.
  await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a')).find((el) => /\/administration\/users$/.test(el.getAttribute('href') || ''));
    if (a) (a as HTMLAnchorElement).click();
  });
  if (!/administration\/users$/.test(page.url())) {
    await visit(page, 'administration/settings');
    await page.locator('.layout-menu a', { hasText: /Users/ }).first().click();
  }
  await page.waitForURL(/administration\/users$/, { timeout: 15_000 });
  await expectOneRow(page.locator('.p-tabmenu-nav .p-tabmenuitem'));
});
