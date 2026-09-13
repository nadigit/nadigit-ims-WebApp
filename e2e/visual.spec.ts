import { test } from '@playwright/test';
import { visit } from './helpers/page-health';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Full-page screenshots for the before/after pass of the PrimeNG theming migration.
 *
 * PrimeNG 18 replaced its CSS-file theme with design tokens, and this app carries 14,033 `.p-*`
 * selectors written against the old layer order. No assertion can tell us whether the result still
 * looks right, so this captures the pages worth looking at by eye:
 *
 *   E2E_SHOT_LABEL=angular17 npx playwright test visual     before
 *   E2E_SHOT_LABEL=angular18 npx playwright test visual     after
 *
 * Writes to e2e/screenshots/<label>/. Not an assertion, and not part of `npm run e2e` gating —
 * toHaveScreenshot would fail on every intended pixel of a theme change, which is the opposite of
 * useful here.
 */
const LABEL = process.env.E2E_SHOT_LABEL ?? 'current';
const OUT = path.join('e2e', 'screenshots', LABEL);

// The pages that carry the most PrimeNG surface: tables, dialogs, pickers, charts, tabs.
const PAGES: Array<{ name: string; path: string }> = [
  { name: '01-dashboard', path: '' },
  { name: '02-products', path: 'inventory/products' },
  { name: '03-orders', path: 'sales/orders' },
  { name: '04-purchases', path: 'purchases/purchases' },
  { name: '05-customers', path: 'sales/customers' },
  { name: '06-expenses', path: 'finance/expenses' },
  { name: '07-financial-documents', path: 'finance/financial-documents' },
  { name: '08-treasury', path: 'finance/treasury' },
  { name: '09-users', path: 'administration/users' },
  { name: '10-settings', path: 'administration/settings' },
];

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

for (const p of PAGES) {
  test(`shot ${p.name}`, async ({ page }) => {
    await visit(page, p.path);
    // Let tables finish drawing before the shutter: a half-rendered grid is not a useful baseline.
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${p.name}.png`), fullPage: true });
  });
}

test('shot 11-pos', async ({ page }) => {
  await page.goto('/webconsole/pos');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '11-pos.png'), fullPage: true });
});
