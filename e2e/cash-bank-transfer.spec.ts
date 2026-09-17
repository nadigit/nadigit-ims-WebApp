import { expect, test } from '@playwright/test';
import { visit } from './helpers/page-health';

/**
 * Opening the cash / bank transfer dialog on a cash register must not freeze the page.
 *
 * Its direction switch took its options from a getter that built a new array on every change
 * detection. PrimeNG 18's SelectButton recreates its toggle buttons for a new options array, which
 * schedules another change detection, which builds another array: an endless loop that hung the tab.
 */
test('cash / bank transfer dialog opens and the page stays responsive', async ({ page }) => {
  await visit(page, 'finance/treasury/cash-registers');
  await page.locator('.p-datatable-tbody tr').first().click();
  await page.waitForURL(/cash-registers\/\d+/, { timeout: 15_000 });

  // The header actions render once the register has loaded.
  await expect(page.getByRole('button', { name: /Open\/Close Session/i }).first()).toBeVisible({ timeout: 15_000 });
  const open = page.getByRole('button', { name: /Cash.*Bank Transfer/i }).first();
  // The button appears once the licence capabilities load, which can trail the header actions.
  await open.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
  test.skip(await open.count() === 0, 'no transfer button: the licence tier has no bank accounts');
  await open.click();

  const dialog = page.locator('.p-dialog').filter({ has: page.locator('#transferAmount') }).first();
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  // A frozen page cannot answer this within the timeout.
  const answered = await Promise.race([
    page.evaluate(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 50))),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  expect(answered, 'page still responds after opening the dialog').toBe(true);

  // And the direction switch works.
  await dialog.locator('.p-selectbutton .p-togglebutton').nth(1).click();
  await expect(dialog.locator('.p-selectbutton .p-togglebutton-checked')).toHaveCount(1);
});
