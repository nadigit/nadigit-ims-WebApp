import { expect, Page, test } from '@playwright/test';
import { visit } from './helpers/page-health';

/**
 * The pricing pages share the list-page conventions: a header of title and description only (any
 * workflow hint sits in the card as a page note), and a table paginator that is always shown with the
 * shared page report and a 20/50/100 page-size picker.
 */
async function expectStandardPaginator(page: Page, table: string) {
  const paginator = page.locator(`${table} .p-paginator`).first();
  await expect(paginator).toBeVisible();
  await expect(paginator.locator('.p-paginator-current')).toHaveText(/\d+ \/ \d+ \(\d+ /);
  const picker = paginator.locator('.p-paginator-rpp-dropdown').first();
  await expect(picker).toBeVisible();
  await expect(picker).toContainText(/^(20|50|100)$/);
}

test('line options table uses the standard paginator', async ({ page }) => {
  await visit(page, 'inventory/line-options');
  await expectStandardPaginator(page, '.p-datatable');
});

test('line price rules table uses the standard paginator', async ({ page }) => {
  await visit(page, 'inventory/line-price-rules');
  await expectStandardPaginator(page, '.p-datatable');
});

// Standing page notes (rules engine off, read-only) look like Warehouse Transfers' note: info tone.
for (const route of ['inventory/line-price-rules', 'finance/tax-rules', 'inventory/warehouse-transfers']) {
  test(`${route} page notes use the standard info style`, async ({ page }) => {
    await visit(page, route);
    await page.waitForTimeout(800);
    const notes = page.locator('app-page-note .ims-note');
    const count = await notes.count();
    for (let i = 0; i < count; i++) {
      await expect(notes.nth(i)).not.toHaveClass(/ims-note--warning/);
    }
  });
}

test('pricing header matches the other list pages and both tables use the standard paginator', async ({ page }) => {
  await visit(page, 'inventory/pricing');
  // The header holds the title and one description line; the workflow hint lives in the card.
  const header = page.locator('.col-12 > .mb-4').first();
  await expect(header.locator('p')).toHaveCount(1);
  await expect(page.locator('.card app-page-note').first()).toBeVisible();

  // A price list, so the lists table and the tier rules table both render.
  if (await page.locator('.p-datatable').count() === 0) {
    await page.getByRole('button', { name: /^\s*(New|Nouveau)\s*$/ }).first().click();
    await page.locator('#pl-name').fill(`E2E Price list ${Date.now() % 100000}`);
    await page.locator('.p-dialog-footer').getByRole('button').last().click();
    await expect(page.locator('.p-datatable').first()).toBeVisible();
  }
  await expectStandardPaginator(page, '.p-datatable');

  await page.locator('.p-tablist-tab-list .p-tab').nth(1).click();
  await expect(page.locator('.p-datatable:visible').first()).toBeVisible();
  await expectStandardPaginator(page, '.p-tabpanels .p-datatable:visible');
});
