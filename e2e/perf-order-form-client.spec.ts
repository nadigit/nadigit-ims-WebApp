import { expect, Page, test } from '@playwright/test';
import { visit } from './helpers/page-health';

/**
 * The order form's own cost, with the server taken out of the picture.
 *
 * The product search and the customer-pricing call are served from a fixture captured once, so what
 * is left is what the browser does: rendering suggestions, rebuilding the line table, and running
 * change detection over every line. Those are what make a 150-line order feel slow, and they are
 * what Phase 2 changes; the end-to-end numbers live in perf-order-form.spec.ts.
 *
 *   PERF=1 npx playwright test e2e/perf-order-form-client.spec.ts --project=chromium
 */
const SIZES = [10, 50, 150];
const TOTAL = Math.max(...SIZES);
const NAME_PREFIX = 'Perf item 200692 ';
const REF_PREFIX = 'PERF200692-';
const WAREHOUSE = 'PERF Wh 200692';

test.setTimeout(30 * 60_000);

// A measurement harness, not a regression test: it needs the perf fixture (warehouse "PERF Wh 200692",
// customer "Perf Customer", products "Perf item 200692 0..999" referenced PERF200692-N) and takes minutes,
// so it runs only when asked for.
test.skip(!process.env.PERF, 'measurement harness - run with PERF=1');

async function pick(page: Page, dialog: ReturnType<Page['locator']>, control: string, label: RegExp) {
  await dialog.locator(control).click();
  await page.getByRole('option', { name: label }).first().click();
}

type Metrics = Record<string, number>;

/**
 * Wall-clock timings on a laptop that is also running the stack move by hundreds of milliseconds
 * between runs. Chrome's own counters say how much CPU the page actually spent, which is what a
 * change to the form moves, so the numbers below are comparable across runs.
 */
async function cpu(client: any): Promise<Metrics> {
  const { metrics } = await client.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map((m: any) => [m.name, m.value]));
}

/** Script, style/layout and total task time between two readings, in milliseconds. */
function spent(before: Metrics, after: Metrics): string {
  const ms = (key: string) => Math.round(((after[key] ?? 0) - (before[key] ?? 0)) * 1000);
  return `${ms('ScriptDuration')} ms script + ${ms('RecalcStyleDuration') + ms('LayoutDuration')} ms style/layout`
    + ` (${ms('TaskDuration')} ms total)`;
}

test('order form: browser cost per line as the order grows', async ({ page }) => {
  let auth = '';
  page.on('request', (r) => {
    const h = r.headers()['authorization'];
    if (h && r.url().includes('/api/')) auth = h;
  });

  await visit(page, 'inventory/products');
  await expect.poll(() => auth, { timeout: 20_000 }).not.toBe('');
  const base = new URL(page.url()).origin;

  // The real answer for each search, captured once, then served from memory: same payload the
  // server would send, without its latency in the measurement.
  const payloads = new Map<string, string>();
  for (let i = 0; i < TOTAL; i++) {
    const term = `${NAME_PREFIX}${i}`;
    const res = await page.request.get(
      `${base}/api/stock/products/search-for-orders?search=${encodeURIComponent(term)}&warehouseId=87`,
      { headers: { authorization: auth } });
    payloads.set(term, await res.text());
  }
  expect(payloads.size).toBe(TOTAL);

  await page.route('**/api/stock/products/search-for-orders*', async (route) => {
    const term = new URL(route.request().url()).searchParams.get('search') ?? '';
    const body = payloads.get(term);
    if (!body) return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body });
  });
  // Customer pricing: answer immediately, so a keystroke measures rendering, not a round trip.
  await page.route('**/api/**customer**price**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

  await visit(page, 'sales/orders');
  await page.getByRole('button', { name: /^\s*New\s*$/ }).first().click();
  const dialog = page.locator('.p-dialog').first();
  await pick(page, dialog, 'p-dropdown:has(#warehouse)', new RegExp(WAREHOUSE, 'i'));
  await pick(page, dialog, 'p-dropdown:has(#customer)', /Perf Customer/i);

  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');

  const rows = dialog.locator('.selected-products-table tbody tr');
  // Above forty lines the table renders only the rows in view, so the row count no longer says how
  // many lines the order has. The section header counts them, and it is rendered from the same pass
  // that rebuilds the table, so it is what the timing waits on.
  const lineCount = dialog.locator('.ims-form-section__subtitle').first();
  const search = dialog.locator('p-autoComplete:has(#productSearch) input').first();
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
  }

  // The last line must be reachable: a scroller that believes rows are shorter than they are stops
  // before the end of the list. What counts is the scroller's own visible box - the table itself may
  // sit below the fold of the dialog.
  const scroller = dialog.locator('.selected-products-table .p-virtualscroller').first();
  let reach = 'not virtualised';
  if (await scroller.count()) {
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(500);
    reach = await scroller.evaluate((el, name) => {
      const box = el.getBoundingClientRect();
      const row = [...el.querySelectorAll('tr.order-line-row')]
        .find((r) => new RegExp(name + '(?!\\d)').test(r.textContent ?? ''));
      if (!row) return 'last line not rendered';
      const r = row.getBoundingClientRect();
      const inside = r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
      return `${inside ? 'visible' : 'NOT visible'} (row ${Math.round(r.top)}-${Math.round(r.bottom)},`
        + ` box ${Math.round(box.top)}-${Math.round(box.bottom)}, scrollHeight ${el.scrollHeight})`;
    }, NAME_PREFIX + (TOTAL - 1));
    await scroller.evaluate((el) => { el.scrollTop = 0; });
  }

  // A keystroke with the whole order on screen, and the DOM size it is rendered into.
  const qty = rows.first().locator('.order-line-input--qty input');
  await qty.click();
  await qty.press('Control+a');
  const keyCpuBefore = await cpu(client);
  const keyStarted = Date.now();
  await qty.type('123', { delay: 60 });
  await expect(rows.first().locator('.col-subtotal')).toContainText(/\d/, { timeout: 20_000 });
  const keyMs = Date.now() - keyStarted;
  const keyCpu = spent(keyCpuBefore, await cpu(client));
  // Proof the order really holds every line, whatever the table chose to render.
  await expect(lineCount).toContainText(new RegExp('(?<!\\d)' + (TOTAL) + '(?!\\d)'));
  const domRows = await rows.count();
  const domNodes = await page.evaluate(() => document.querySelectorAll('.selected-products-table tbody *').length);
  // Row heights decide whether virtual scrolling is possible: it needs one fixed size for every row.
  const heights = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('.selected-products-table tbody tr')].map((r) => (r as HTMLElement).offsetHeight);
    return { min: Math.min(...hs), max: Math.max(...hs) };
  });

  console.log(`PERF client-only (${TOTAL} lines)\n` + [
    ...SIZES.map((n) => `  add line #${n}: ${addCpu.get(n)} — ${addMs.get(n)} ms wall`),
    `  typing "123" at ${TOTAL} lines: ${keyCpu} — ${keyMs} ms wall`,
    `  line rows in the DOM: ${domRows}, elements under them: ${domNodes}`,
    `  row height: ${heights.min}-${heights.max} px`,
    `  last line after scrolling to the end: ${reach}`,
  ].join('\n'));
  expect(reach).not.toMatch(/NOT visible|not rendered/);
});
