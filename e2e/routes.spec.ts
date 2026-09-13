import { test, expect } from '@playwright/test';
import { assertHealthy, visit, watchForProblems } from './helpers/page-health';

/**
 * Every top-level page renders.
 *
 * This is the broadest, cheapest net there is: 137 components, and the failure mode a framework
 * upgrade actually produces is "this route throws on load and shows nothing". One test per route
 * catches that across the whole app in a couple of minutes.
 */
const ROUTES: Array<{ name: string; path: string }> = [
  { name: 'dashboard', path: '' },

  { name: 'products', path: 'inventory/products' },
  { name: 'product families', path: 'inventory/product-families' },
  { name: 'categories', path: 'inventory/categories' },
  { name: 'warehouses', path: 'inventory/warehouses' },
  { name: 'shops', path: 'inventory/shops' },
  { name: 'warehouse transfers', path: 'inventory/warehouse-transfers' },
  { name: 'write-offs', path: 'inventory/write-offs' },
  { name: 'stock movements', path: 'inventory/stock-movements' },

  { name: 'suppliers', path: 'purchases/suppliers' },
  { name: 'purchases', path: 'purchases/purchases' },
  { name: 'purchase returns', path: 'purchases/purchase-returns' },

  { name: 'orders', path: 'sales/orders' },
  { name: 'sales returns', path: 'sales/returns' },
  { name: 'customers', path: 'sales/customers' },

  { name: 'expenses', path: 'finance/expenses' },
  { name: 'payments', path: 'finance/payments' },
  { name: 'refunds', path: 'finance/refunds' },
  { name: 'purchase credits', path: 'finance/purchase-credits' },
  { name: 'financial documents', path: 'finance/financial-documents' },
  { name: 'banking', path: 'finance/banking' },
  { name: 'treasury', path: 'finance/treasury' },

  { name: 'reports', path: 'reports' },
  { name: 'users', path: 'administration/users' },
  { name: 'settings', path: 'administration/settings' },
  { name: 'company', path: 'administration/my-company' },
  { name: 'profile', path: 'profile' },
];

for (const route of ROUTES) {
  test(`${route.name} renders`, async ({ page }, testInfo) => {
    const problems = watchForProblems(page);
    await visit(page, route.path);

    // Landed where we asked, rather than on the not-found route or back at Keycloak.
    expect(page.url()).toContain(`/webconsole/${route.path}`);
    await expect(page.locator('.layout-topbar')).toBeVisible();

    await assertHealthy(problems, route.name, testInfo);
  });
}

test('POS opens', async ({ page }, testInfo) => {
  // POS hides the shell, so it gets its own assertion rather than an exception in the loop.
  const problems = watchForProblems(page);
  await page.goto('/webconsole/pos');
  await page.waitForLoadState('networkidle');
  expect(page.url()).toContain('/webconsole/pos');
  await assertHealthy(problems, 'pos', testInfo);
});
