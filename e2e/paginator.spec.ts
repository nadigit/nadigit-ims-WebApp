import { expect, test } from '@playwright/test';
import { visit } from './helpers/page-health';

/**
 * Every table paginator stays on one line with a compact page-size picker.
 *
 * Pages that wrap their content in a .p-fluid grid (the items page among them) stretched the picker to
 * the full width under the page links once PrimeNG 18 dropped its own fluid handling and ours took over.
 */
const ROUTES = ['inventory/products', 'inventory/categories', 'inventory/warehouses', 'inventory/shops',
  'inventory/warehouse-transfers', 'inventory/write-offs', 'inventory/stock-movements', 'purchases/suppliers',
  'purchases/purchases', 'purchases/purchase-returns', 'sales/orders', 'sales/returns', 'sales/customers',
  'finance/expenses', 'finance/payments', 'finance/refunds', 'finance/purchase-credits',
  'finance/financial-documents', 'finance/banking', 'administration/users'];

for (const route of ROUTES) {
  test(`${route} paginator stays on one line`, async ({ page }) => {
    await visit(page, route);
    await page.waitForTimeout(1000);
    const paginators = page.locator('.p-datatable .p-paginator:visible');
    const count = await paginators.count();
    for (let i = 0; i < count; i++) {
      const p = paginators.nth(i);
      const picker = p.locator('.p-paginator-rpp-dropdown').first();
      if (await picker.count() === 0) continue;
      const [pb, rb] = [await p.boundingBox(), await picker.boundingBox()];
      expect(pb && rb, `${route}: paginator ${i} laid out`).toBeTruthy();
      expect(rb!.width, `${route}: page-size picker width`).toBeLessThan(160);
      expect(pb!.height, `${route}: paginator height`).toBeLessThan(80);
    }
  });
}
