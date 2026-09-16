import { expect, Page, test } from '@playwright/test';
import { visit } from './helpers/page-health';

// An open option list is exactly as wide as its field. PrimeNG 18 stopped sizing lists rendered with
// appendTo="body" (most forms here): first they shrank to their longest option, and with only a
// minimum width a narrow field with long options (countries) opened a list wider than itself.
async function expectListAsWideAsField(page: Page, field: string) {
  const trigger = page.locator(field).first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const list = page.locator('.p-select-overlay, .p-multiselect-overlay').first();
  await list.waitFor();
  await page.waitForTimeout(300);
  const [t, l] = [await trigger.boundingBox(), await list.boundingBox()];
  expect(t && l).toBeTruthy();
  expect(Math.abs(l!.width - t!.width)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
}

async function openNewDialog(page: Page, path: string) {
  await visit(page, path);
  await page.getByRole('button', { name: /^\s*(New|Nouveau)\s*$/ }).first().click();
  await page.locator('.p-dialog').first().waitFor();
}

test('filter bar select opens a list as wide as the field', async ({ page }) => {
  await visit(page, 'sales/orders');
  await expectListAsWideAsField(page, '.filter-bar .p-select');
});

test('dialog select opens a list as wide as the field', async ({ page }) => {
  await openNewDialog(page, 'finance/expenses');
  await expectListAsWideAsField(page, '.p-dialog .p-select');
});

test('narrow country select does not open a wider list', async ({ page }) => {
  await openNewDialog(page, 'inventory/shops');
  await expectListAsWideAsField(page, '.p-dialog .p-select:has(#country)');
});

test('stock tracking method select does not open a wider list', async ({ page }) => {
  await openNewDialog(page, 'inventory/products');
  await expectListAsWideAsField(page, '.p-dialog .p-select:has(#stockTrackingMode)');
});
