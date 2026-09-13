import { Locator, Page, expect } from '@playwright/test';

/**
 * The vocabulary the interaction specs are written in.
 *
 * routes.spec.ts proves every page renders, which is not enough to land the PrimeNG migration.
 * That migration changes how `pButton` renders its `icon` and `label` attributes, and 1,058
 * buttons in this app pass both that way. A button that renders as an empty box still "renders":
 * the route resolves, nothing throws, no request 5xxs, and a smoke suite sees a healthy page.
 * Only clicking things catches it.
 *
 * Two rules keep these helpers from rotting the moment PrimeNG renames something.
 *
 *   1. Reach for what the app owns. Field ids (#categoryName), our own layout classes
 *      (.ims-page-actions) and ARIA roles are ours or standard; `.p-datatable` and friends belong
 *      to the library and are renamed between majors — which is the very event this suite has to
 *      survive in order to report on it.
 *
 *   2. Assert outcomes, not markup. "the row is present", "the dialog closed", "it said it
 *      worked" all survive a re-skin. "the header cell carries class X" does not.
 *
 * `iconButton` is the deliberate exception: row actions are icon-only `pButton`s carrying a
 * tooltip but no accessible name, so the PrimeIcons class is the only handle they offer. That is
 * a feature here rather than a compromise — those selectors are precisely what stops matching
 * when `pButton` stops rendering `icon`, which is the regression this suite exists to find.
 */

/** How long a save round trip may take: API call, toast, list reload, on a laptop. */
const SAVE_TIMEOUT = 30_000;

/**
 * A name no other run will collide with.
 *
 * Specs create real rows in a real database. They clean up after themselves, but a spec that
 * fails half way leaves its row behind, and the next run must not trip over it. The timestamp
 * also makes leftovers obvious and greppable when someone wonders what "E2E" rows are.
 */
export function uniqueName(prefix: string): string {
    return `E2E ${prefix} ${Date.now().toString().slice(-8)}`;
}

/** The top-right New / Delete cluster that 25 list pages share. */
export function toolbar(page: Page): Locator {
    return page.locator('.ims-page-actions');
}

/**
 * The open modal dialog.
 *
 * PrimeNG renders dialog content only while visible, so this does not match closed ones. Pass a
 * name to disambiguate when a page can have two open at once (a form over a confirmation): the
 * dialog's aria-labelledby points at its own header.
 */
export function dialog(page: Page, name?: string): Locator {
    return name ? page.getByRole('dialog', { name }) : page.getByRole('dialog');
}

/** A button by its visible label, within a page or a dialog. */
export function button(scope: Page | Locator, name: string | RegExp): Locator {
    return scope.getByRole('button', { name });
}

/**
 * An icon-only button, by the PrimeIcons class its `icon` attribute renders.
 *
 * `icon` is a name like 'pencil', 'trash', 'eye' — the part after `pi pi-`.
 */
export function iconButton(scope: Page | Locator, icon: string): Locator {
    return scope.locator(`button:has(.pi-${icon})`);
}

/**
 * Narrows a list down to one record.
 *
 * Going through the page's own filter rather than paging: a freshly created row lands wherever
 * the current sort puts it, which on a seeded database is rarely page one.
 */
export async function search(page: Page, term: string): Promise<void> {
    const box = page.getByPlaceholder('Search...').first();
    await box.fill(term);
    // The table filters on input with no debounce of its own, but the rows still have to redraw.
    await expect(row(page, term)).toBeVisible({ timeout: 15_000 });
    // Some lists reload from the server as they filter. Without waiting for that to settle, a row
    // action can be clicked on a row Angular is about to replace: the click lands on whatever is
    // underneath — usually the row itself, which navigates to the details page — and the spec
    // fails somewhere far away from the actual cause.
    await page.waitForLoadState('networkidle');
}

/** The table row containing this text. */
export function row(page: Page, text: string): Locator {
    return page.getByRole('row').filter({ hasText: text });
}

/**
 * Waits for a toast saying this.
 *
 * Secondary evidence on purpose. Toasts dismiss themselves after a few seconds, so a spec that
 * only checked for one would be timing-dependent; every spec here also asserts the durable
 * outcome (the row exists, the dialog closed). This is what distinguishes "it saved" from "it
 * silently did nothing", which is the failure the save-flow rewrite was about.
 */
export async function expectToast(page: Page, fragment: string | RegExp): Promise<void> {
    await expect(page.getByRole('alert').filter({ hasText: fragment }).first())
        .toBeVisible({ timeout: SAVE_TIMEOUT });
}

/**
 * Clears any toast still on screen.
 *
 * Toasts stack in the top-right corner, which is exactly where the New and Delete buttons live.
 * A leftover success toast will swallow the next click and produce a failure that looks like a
 * broken button. Call this between steps that both touch the toolbar.
 */
export async function clearToasts(page: Page): Promise<void> {
    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: SAVE_TIMEOUT });
}

/** Clicks Save and waits for the dialog to actually close. */
export async function save(page: Page, scope: Locator): Promise<void> {
    await button(scope, 'Save').click();
    // The save flow closes the dialog only after the server accepts the record. A dialog still
    // open here means the save failed, which is the behaviour we want — and want to see.
    await expect(scope).toBeHidden({ timeout: SAVE_TIMEOUT });
}
