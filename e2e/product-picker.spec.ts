import { expect, Locator, Page, test } from '@playwright/test';
import { visit } from './helpers/page-health';
import { button, clearToasts, dialog, iconButton, row, save, search, toolbar, uniqueName } from './helpers/ui';

/**
 * Every product picker looks like the orders form's.
 *
 * Pickers across the console had grown their own suggestion rows (a bare name, name and reference,
 * a stock column, a plain dropdown). They now share <app-product-option> inside an autocomplete with
 * the ims-product-picker class. This creates one item, types into each picker, and requires the
 * shared row with the item's name and type badge; then it removes what it created.
 */
const CATEGORY = uniqueName('PPCat');
const WAREHOUSE = uniqueName('PPWh');
const SUPPLIER = uniqueName('PPSup');
const ITEM = uniqueName('PPItem');

async function choose(page: Page, control: Locator, option: string) {
  await control.click();
  await page.getByRole('option', { name: option }).first().click();
}

async function expectSharedRow(page: Page, field: Locator) {
  await field.scrollIntoViewIfNeeded();
  // styleClass lands on PrimeNG's inner .p-autocomplete, inside the <p-autocomplete> host.
  await expect(field.locator('.p-autocomplete.ims-product-picker')).toHaveCount(1);
  const input = field.locator('input').first();
  await input.click();
  await input.fill(ITEM);
  const option = page.locator('.p-autocomplete-overlay .ims-product-option', { hasText: ITEM }).first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await expect(option.locator('.ims-product-option__image')).toBeVisible();
  await expect(option.locator('.p-tag')).toBeVisible();
  await page.keyboard.press('Escape');
}

test.describe.serial('product pickers', () => {
  test.setTimeout(120_000);

  test('fixtures: an item with its category, warehouse and supplier', async ({ page }) => {
    for (const f of [
      { path: 'inventory/categories', header: 'Category Details', field: '#categoryName', value: CATEGORY },
      { path: 'inventory/warehouses', header: 'New Warehouse', field: '#name', value: WAREHOUSE },
      { path: 'purchases/suppliers', header: 'Supplier Details', field: '#name', value: SUPPLIER },
    ]) {
      await visit(page, f.path);
      await button(toolbar(page), 'New').first().click();
      const form = dialog(page, f.header);
      await form.locator(f.field).fill(f.value);
      await save(page, form);
      await clearToasts(page);
    }
    await visit(page, 'inventory/products');
    await page.getByRole('button', { name: 'New' }).first().click();
    const form = dialog(page, 'Item Details');
    await form.locator('#productName').fill(ITEM);
    await form.locator('#reference').fill(`PP-${Date.now().toString().slice(-8)}`);
    await choose(page, form.locator('p-dropdown:has(#category)'), CATEGORY);
    await choose(page, form.locator('p-dropdown:has(#warehouse)'), WAREHOUSE);
    await choose(page, form.locator('p-dropdown:has(#supplier)'), SUPPLIER);
    await form.locator('#buyingPrice').fill('10');
    await form.locator('#sellingPrice').fill('20');
    // In stock: the orders picker only offers what can be sold from the chosen warehouse.
    await form.locator('#quantityAvailable').fill('5');
    await save(page, form);
    await clearToasts(page);
  });

  test('orders form', async ({ page }) => {
    await visit(page, 'sales/orders');
    await page.getByRole('button', { name: /^\s*New\s*$/ }).first().click();
    const d = page.locator('.p-dialog').first();
    await choose(page, d.locator('p-dropdown:has(#warehouse)'), WAREHOUSE);
    await expectSharedRow(page, d.locator('p-autocomplete:has(#productSearch)'));
  });

  test('stock movements filter', async ({ page }) => {
    await visit(page, 'inventory/stock-movements');
    await expectSharedRow(page, page.locator('.filter-bar p-autocomplete').first());
  });

  test('write-offs filter', async ({ page }) => {
    await visit(page, 'inventory/write-offs');
    await expectSharedRow(page, page.locator('.filter-bar p-autocomplete').first());
  });

  test('tax rules simulator', async ({ page }) => {
    await visit(page, 'finance/tax-rules');
    await expectSharedRow(page, page.locator('p-autocomplete:has(#simProduct)').first());
  });

  test('pricing tier rule', async ({ page }) => {
    await visit(page, 'inventory/pricing');
    await page.locator('.p-tablist-tab-list .p-tab').nth(1).click();
    await page.getByRole('button', { name: /Add Rule/i }).first().click();
    await expectSharedRow(page, page.locator('.p-dialog p-autocomplete:has(#tier-product-ac)').first());
  });

  test('warehouse transfer line', async ({ page }) => {
    await visit(page, 'inventory/warehouse-transfers');
    await page.getByRole('button', { name: /New Transfer/i }).first().click();
    const d = page.locator('.p-dialog').first();
    await choose(page, d.locator('p-dropdown:has(#sourceWarehouse)'), WAREHOUSE);
    await d.getByRole('button', { name: /Add Item/i }).first().click();
    await expectSharedRow(page, d.locator('p-autocomplete:has(.ims-product-picker)').first());
  });

  test('fixtures removed', async ({ page }) => {
    for (const f of [
      { path: 'inventory/products', value: ITEM },
      { path: 'purchases/suppliers', value: SUPPLIER },
      { path: 'inventory/warehouses', value: WAREHOUSE },
      { path: 'inventory/categories', value: CATEGORY },
    ]) {
      await visit(page, f.path);
      await search(page, f.value);
      await iconButton(row(page, f.value), 'trash').first().click();
      const confirm = dialog(page, 'Confirm');
      await expect(confirm).toBeVisible();
      await button(confirm, 'Yes').click();
      await expect(confirm).toBeHidden();
      await clearToasts(page);
    }
  });
});
