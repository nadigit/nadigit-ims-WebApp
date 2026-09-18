import { expect, Page, test } from '@playwright/test';
import { visit } from './helpers/page-health';

/**
 * How the order form behaves as an order grows — the client side of the 150–200-line problem.
 *
 * Phase 1 made the server save a 200-line order in a third of the time; this measures what the
 * browser does while the order is being typed: adding a line at 10, 50 and 150 lines, the delay
 * after a quantity keystroke, and how many API calls that keystroke costs.
 *
 * It is a measurement harness, not an assertion: run it before and after a change and compare.
 *   PERF=1 npx playwright test e2e/perf-order-form.spec.ts --project=chromium
 */
const SIZES = [10, 50, 150];
const TOTAL = Math.max(...SIZES);
const REF_PREFIX = process.env.PERF_REF_PREFIX ?? 'PERF200692-';
const PRODUCT_NAME = process.env.PERF_NAME_PREFIX ?? 'Perf item 200692 ';
const WAREHOUSE = process.env.PERF_WAREHOUSE ?? 'PERF Wh 200692';

test.setTimeout(30 * 60_000);

// A measurement harness, not a regression test: it needs the perf fixture (warehouse "PERF Wh 200692",
// customer "Perf Customer", products "Perf item 200692 0..999" referenced PERF200692-N) and takes minutes,
// so it runs only when asked for.
test.skip(!process.env.PERF, 'measurement harness - run with PERF=1');

async function pick(page: Page, dialog: ReturnType<Page['locator']>, control: string, label: RegExp | string) {
  await dialog.locator(control).click();
  await page.getByRole('option', { name: label }).first().click();
}

/** Adds one line, timing the server search and the browser's own work separately. */
async function addLine(page: Page, dialog: ReturnType<Page['locator']>, index: number, expected: number): Promise<{ search: number; commit: number }> {
  const search = dialog.locator('p-autoComplete:has(#productSearch) input').first();
  const started = Date.now();
  await search.click();
  await search.fill(`${PRODUCT_NAME}${index}`);
  // The suggestion row carries the reference, which identifies the product exactly (name 1 also
  // matches 10, 100 ...).
  const option = page.locator('.p-autocomplete-overlay .ims-product-option')
      .filter({ hasText: new RegExp(`${REF_PREFIX}${index}(?!\d)`) }).first();
  await option.waitFor({ timeout: 20_000 });
  const searched = Date.now();
  await option.click();
  await expect(dialog.locator('.selected-products-table tbody tr')).toHaveCount(expected, { timeout: 30_000 });
  return { search: searched - started, commit: Date.now() - searched };
}

test('order form: adding lines and editing a quantity as the order grows', async ({ page }) => {
  const apiCalls: { url: string; at: number }[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) apiCalls.push({ url: r.url(), at: Date.now() });
  });

  await visit(page, 'sales/orders');
  await page.getByRole('button', { name: /^\s*New\s*$/ }).first().click();
  const dialog = page.locator('.p-dialog').first();
  await pick(page, dialog, 'p-dropdown:has(#warehouse)', new RegExp(WAREHOUSE, 'i'));
  // A customer makes the form resolve customer pricing, which is what the keystroke path costs.
  await pick(page, dialog, 'p-dropdown:has(#customer)', /Perf Customer/i);

  const addTimes = new Map<number, { search: number; commit: number }>();
  for (let i = 0; i < TOTAL; i++) {
    const ms = await addLine(page, dialog, i, i + 1);
    if (SIZES.includes(i + 1)) addTimes.set(i + 1, ms);
  }

  // A single keystroke in the first line's quantity, with 150 lines on screen.
  const qty = dialog.locator('.selected-products-table tbody tr').first().locator('.order-line-input--qty input');
  await qty.click();
  await qty.press('Control+a');
  const before = apiCalls.length;
  const keyStarted = Date.now();
  // What a user actually does: several characters in a row.
  await qty.type('123', { delay: 60 });
  // Settled = no new API call for 500 ms.
  let quiet = Date.now();
  for (;;) {
    const seen = apiCalls.length;
    await page.waitForTimeout(100);
    if (apiCalls.length === seen) {
      if (Date.now() - quiet > 500) break;
    } else {
      quiet = Date.now();
    }
    if (Date.now() - keyStarted > 30_000) break;
  }
  const keyMs = Date.now() - keyStarted - 500;
  const keyCalls = apiCalls.length - before;

  // Saving the order: the server side Phase 1 already improved.
  const saveStarted = Date.now();
  await dialog.getByRole('button', { name: /^\s*Save\s*$/ }).first().click();
  await expect(page.locator('.p-dialog')).toHaveCount(0, { timeout: 180_000 });
  const saveMs = Date.now() - saveStarted;

  const rows = [
    ...SIZES.map((n) => `  add line #${n}: search ${addTimes.get(n)!.search} ms + browser ${addTimes.get(n)!.commit} ms`),
    `  typing "123" in a quantity at ${TOTAL} lines: ${keyMs} ms to settle, ${keyCalls} API call(s)`,
    `  save ${TOTAL} lines: ${saveMs} ms`,
  ];
  console.log(`PERF order form (${TOTAL} lines)\n${rows.join('\n')}`);
});
