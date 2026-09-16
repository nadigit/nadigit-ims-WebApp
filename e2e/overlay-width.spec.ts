import { expect, Page, test } from '@playwright/test';
import { visit } from './helpers/page-health';

// An open option list is at least as wide as its field. PrimeNG 18 stopped stretching lists rendered
// with appendTo="body" (most forms here), so they shrank to their longest option.
async function expectListAsWideAsField(page: Page, field: string) {
  const trigger = page.locator(field).first();
  await trigger.click();
  const list = page.locator('.p-select-overlay, .p-multiselect-overlay').first();
  await list.waitFor();
  const [t, l] = [await trigger.boundingBox(), await list.boundingBox()];
  expect(t && l).toBeTruthy();
  expect(l!.width).toBeGreaterThanOrEqual(t!.width - 1);
  await page.keyboard.press('Escape');
}

test('filter bar select opens a list as wide as the field', async ({ page }) => {
  await visit(page, 'sales/orders');
  await expectListAsWideAsField(page, '.filter-bar .p-select');
});

test('dialog select opens a list as wide as the field', async ({ page }) => {
  await visit(page, 'finance/expenses');
  await page.getByRole('button', { name: /^\s*(New|Nouveau)\s*$/ }).first().click();
  await page.locator('.p-dialog').first().waitFor();
  await expectListAsWideAsField(page, '.p-dialog .p-select');
});
