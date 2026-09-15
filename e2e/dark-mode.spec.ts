import { expect, test } from '@playwright/test';
import { visit } from './helpers/page-health';

// The config panel's dark-mode switch applies without a reload and throws nothing. From 3.2.18 to the fix
// it threw on the theme <link> PrimeNG 18 no longer has, and the page stayed light until reloaded.
test('dark mode switch applies without a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => localStorage.setItem('darkMode', 'light'));
  await visit(page, '');
  await page.locator('.layout-config-button').click();
  await page.locator('.layout-config-sidebar .p-toggleswitch').first().click();
  await page.waitForTimeout(800);
  const cls = await page.evaluate(() => document.documentElement.className + ' | ' + document.documentElement.getAttribute('color-scheme'));
  expect(cls).toContain('layout-theme-dark');
  expect(errors.filter(e => /cloneNode|TypeError/.test(e))).toEqual([]);
});
