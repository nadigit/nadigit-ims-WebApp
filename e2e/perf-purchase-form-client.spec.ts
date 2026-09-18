import { expect, Page, test } from '@playwright/test';
import { visit } from './helpers/page-health';

/**
 * The purchase form's own cost as a purchase grows, with the server taken out of the picture - the
 * purchase-side twin of perf-order-form-client.spec.ts.
 *
 * Product search and the supplier-price lookup are served from memory, so what is measured is what
 * the browser does: rendering the line table (each purchase line is two rows, one of them holding a
 * date picker), and re-evaluating the summary on every change-detection pass.
 *
 *   PERF=1 npx playwright test e2e/perf-purchase-form-client.spec.ts --project=chromium
 */
const SIZES = [10, 50, 150];
const TOTAL = Math.max(...SIZES);
const NAME_PREFIX = 'Perf item 200692 ';
const REF_PREFIX = 'PERF200692-';
const WAREHOUSE = 'PERF Wh 200692';
const SUPPLIER = 'PERF Sup 200692';

test.setTimeout(30 * 60_000);

// A measurement harness, not a regression test: it needs the perf fixture (warehouse "PERF Wh 200692",
// supplier "PERF Sup 200692", products "Perf item 200692 0..999" referenced PERF200692-N) and takes
// minutes, so it runs only when asked for.
test.skip(!process.env.PERF, 'measurement harness - run with PERF=1');

async function pick(page: Page, dialog: ReturnType<Page['locator']>, control: string, label: RegExp) {
  await dialog.locator(control).click();
  await page.getByRole('option', { name: label }).first().click();
}

type Metrics = Record<string, number>;

/** "MAD 1,234.50" -> 1234.5 */
function amount(text: string | null): number {
  return Number((text ?? '').replace(/[^0-9.]/g, '')) || 0;
}

/** Chrome's own CPU counters: comparable across runs where wall-clock timings on this laptop are not. */
async function cpu(client: any): Promise<Metrics> {
  const { metrics } = await client.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map((m: any) => [m.name, m.value]));
}

function spent(before: Metrics, after: Metrics): string {
  const ms = (key: string) => Math.round(((after[key] ?? 0) - (before[key] ?? 0)) * 1000);
  return `${ms('ScriptDuration')} ms script + ${ms('RecalcStyleDuration') + ms('LayoutDuration')} ms style/layout`
    + ` (${ms('TaskDuration')} ms total)`;
}

test('purchase form: browser cost per line as the purchase grows', async ({ page }) => {
  let auth = '';
  page.on('request', (r) => {
    const h = r.headers()['authorization'];
    if (h && r.url().includes('/api/')) auth = h;
  });

  await visit(page, 'inventory/products');
  await expect.poll(() => auth, { timeout: 20_000 }).not.toBe('');
  const base = new URL(page.url()).origin;

  // The real answer for each search, captured once and then served from memory.
  const payloads = new Map<string, string>();
  for (let i = 0; i < TOTAL; i++) {
    const term = `${NAME_PREFIX}${i}`;
    const res = await page.request.get(
      `${base}/api/stock/products/search-for-purchases-distinct?search=${encodeURIComponent(term)}&warehouseId=87`,
      { headers: { authorization: auth } });
    payloads.set(term, await res.text());
  }
  expect(payloads.size).toBe(TOTAL);

  await page.route('**/api/stock/products/search-for-purchases-distinct*', async (route) => {
    const term = new URL(route.request().url()).searchParams.get('search') ?? '';
    const body = payloads.get(term);
    if (!body) return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body });
  });
  // The supplier-price lookup fired for every added line: no approved-vendor price, immediately.
  await page.route(/\/api\/stock\/products\/\d+\/suppliers$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  await visit(page, 'purchases/purchases');
  await page.getByRole('button', { name: /^\s*New\s*$/ }).first().click();
  const dialog = page.locator('.p-dialog').first();
  await pick(page, dialog, 'p-dropdown:has(#purchaseWarehouse)', new RegExp(WAREHOUSE, 'i'));
  await pick(page, dialog, 'p-dropdown:has(#supplier)', new RegExp(SUPPLIER, 'i'));

  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');

  const rows = dialog.locator('.selected-products-table tbody tr.purchase-line-row');
  // Virtualised tables render only the rows in view; the section header counts every line.
  const lineCount = dialog.locator('.ims-form-section__subtitle').first();
  const search = dialog.locator('p-autoComplete:has(#purchaseProductSearch) input').first();
  const addMs = new Map<number, number>();
  const addCpu = new Map<number, string>();

  for (let i = 0; i < TOTAL; i++) {
    await search.click();
    await search.fill(`${NAME_PREFIX}${i}`);
    const option = page.locator('.p-autocomplete-overlay .ims-product-option')
      .filter({ hasText: new RegExp(`${REF_PREFIX}${i}(?!\\d)`) }).first();
    await option.waitFor({ timeout: 20_000 });
    const cpuBefore = SIZES.includes(i + 1) ? await cpu(client) : null;
    const started = Date.now();
    await option.click();
    await expect(lineCount).toContainText(new RegExp('(?<!\\d)' + (i + 1) + '(?!\\d)'), { timeout: 30_000 });
    if (cpuBefore) {
      addMs.set(i + 1, Date.now() - started);
      addCpu.set(i + 1, spent(cpuBefore, await cpu(client)));
    }
    if (i + 1 === 3) {
      // The summary is computed once per pass now, not per binding: it must still add up.
      const lineSum = (await rows.locator('.col-subtotal').allTextContents()).reduce((sum, t) => sum + amount(t), 0);
      await expect.poll(async () => amount(await dialog.locator('.purchase-summary-total__amount').textContent()))
        .toBeCloseTo(lineSum, 2);
      expect(lineSum).toBeGreaterThan(0);
    }
  }

  // The last line must be reachable inside the scroll box.
  const scroller = dialog.locator('.selected-products-table .p-virtualscroller').first();
  let reach = 'not virtualised';
  if (await scroller.count()) {
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(500);
    reach = await scroller.evaluate((el, name) => {
      const box = el.getBoundingClientRect();
      const lines = [...el.querySelectorAll('tr.purchase-line-row')];
      const row = lines.find((r) => new RegExp(name + '(?!\\d)').test(r.textContent ?? ''));
      if (!row) return 'last line not rendered';
      // The line's batch row sits under it and is part of the same line.
      const next = row.nextElementSibling as HTMLElement | null;
      const bottom = next?.classList.contains('purchase-line-batch-row')
        ? next.getBoundingClientRect().bottom : row.getBoundingClientRect().bottom;
      const top = row.getBoundingClientRect().top;
      const inside = top >= box.top - 1 && bottom <= box.bottom + 1;
      return `${inside ? 'visible' : 'NOT visible'} (line ${Math.round(top)}-${Math.round(bottom)},`
        + ` box ${Math.round(box.top)}-${Math.round(box.bottom)}, scrollHeight ${el.scrollHeight})`;
    }, NAME_PREFIX + (TOTAL - 1));
    await scroller.evaluate((el) => { el.scrollTop = 0; });
  }

  // Typing a quantity with the whole purchase in the form.
  const qty = rows.first().locator('.purchase-line-input--qty input');
  await qty.click();
  await qty.press('Control+a');
  const keyCpuBefore = await cpu(client);
  const keyStarted = Date.now();
  await qty.type('123', { delay: 60 });
  await expect(rows.first().locator('.col-subtotal')).toContainText(/\d/, { timeout: 20_000 });
  const keyMs = Date.now() - keyStarted;
  const keyCpu = spent(keyCpuBefore, await cpu(client));

  await expect(lineCount).toContainText(new RegExp('(?<!\\d)' + TOTAL + '(?!\\d)'));
  const domRows = await rows.count();
  const domNodes = await page.evaluate(() => document.querySelectorAll('.selected-products-table tbody *').length);
  const heights = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('.selected-products-table tbody tr.purchase-line-row')].map((r) => {
      const next = r.nextElementSibling as HTMLElement | null;
      const batch = next?.classList.contains('purchase-line-batch-row') ? next.offsetHeight : 0;
      return (r as HTMLElement).offsetHeight + batch;
    });
    return { min: Math.min(...hs), max: Math.max(...hs) };
  });

  console.log(`PERF purchase client-only (${TOTAL} lines)\n` + [
    ...SIZES.map((n) => `  add line #${n}: ${addCpu.get(n)} — ${addMs.get(n)} ms wall`),
    `  typing "123" at ${TOTAL} lines: ${keyCpu} — ${keyMs} ms wall`,
    `  line rows in the DOM: ${domRows}, elements under them: ${domNodes}`,
    `  line height (line + batch row): ${heights.min}-${heights.max} px`,
    `  last line after scrolling to the end: ${reach}`,
  ].join('\n'));
  expect(reach).not.toMatch(/NOT visible|not rendered/);
});
