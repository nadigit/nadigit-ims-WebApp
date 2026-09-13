import { test, expect } from '@playwright/test';
import { assertHealthy, visit, watchForProblems } from './helpers/page-health';
import {
    button,
    clearToasts,
    dialog,
    expectToast,
    iconButton,
    row,
    rowCheckbox,
    save,
    search,
    toolbar,
    uniqueName,
} from './helpers/ui';

/**
 * What the app does when you use it.
 *
 * routes.spec.ts answers "does every page still draw". This answers the question that actually
 * gates the PrimeNG migration: do the controls on those pages still work. The migration stops
 * `pButton` from rendering `icon` and `label` attributes, and 1,058 buttons in this app rely on
 * exactly that — a change no rendering test can see, because a button with no icon and no label
 * is still a button, on a page that still loads.
 *
 * These specs create real records in the local stack's database and delete them again. They run
 * serially per module (one worker, one database) and each module cleans up after itself, so a
 * full run leaves the data as it found it. A run that fails part way leaves rows named "E2E ..."
 * behind, which is deliberate: they are evidence, and they are easy to find and drop.
 */

test.describe.serial('categories', () => {
    // One name for the whole block: these specs are steps in a single round trip, not independent
    // cases. Computed once at module load so every step in the describe refers to the same record.
    const NAME = uniqueName('Cat');
    const RENAMED = `${NAME} edited`;

    test('New opens the form dialog, Cancel closes it', async ({ page }, testInfo) => {
        const problems = watchForProblems(page);
        await visit(page, 'inventory/categories');

        await button(toolbar(page), 'New').click();
        await expect(dialog(page, 'Category Details')).toBeVisible();

        await button(dialog(page), 'Cancel').click();
        await expect(dialog(page)).toBeHidden();

        await assertHealthy(problems, 'categories new dialog', testInfo);
    });

    test('saving with no name is refused and the dialog stays open', async ({ page }) => {
        await visit(page, 'inventory/categories');
        await button(toolbar(page), 'New').click();

        const form = dialog(page, 'Category Details');
        await expect(form).toBeVisible();

        await button(form, 'Save').click();

        // The point of the save-flow rewrite: a save that cannot succeed leaves the dialog open
        // with the work still in it, rather than closing on an unresolved promise and losing it.
        await expect(form).toBeVisible();
        await expect(form.getByText('Name is required')).toBeVisible();

        await button(form, 'Cancel').click();
        await expect(dialog(page)).toBeHidden();
    });

    test('creating a category adds it to the list', async ({ page }) => {
        await visit(page, 'inventory/categories');
        await button(toolbar(page), 'New').click();

        const form = dialog(page, 'Category Details');
        await form.locator('#categoryName').fill(NAME);
        await form.locator('#description').fill('Created by the interaction suite.');
        await save(page, form);

        await expectToast(page, /created/i);
        await clearToasts(page);

        await search(page, NAME);
        await expect(row(page, NAME)).toBeVisible();
    });

    test('editing a category persists the change', async ({ page }) => {
        await visit(page, 'inventory/categories');
        await search(page, NAME);

        await iconButton(row(page, NAME), 'pencil').click();

        const form = dialog(page, 'Category Details');
        await expect(form).toBeVisible();
        // The dialog opened on the record we asked for, not a blank one.
        await expect(form.locator('#categoryName')).toHaveValue(NAME);

        await form.locator('#categoryName').fill(RENAMED);
        await save(page, form);

        await expectToast(page, /updated/i);
        await clearToasts(page);

        // Reloaded from the server rather than patched in place: this is the assertion that the
        // save actually reached the backend.
        await page.reload();
        await search(page, RENAMED);
        await expect(row(page, RENAMED)).toBeVisible();
    });

    test('delete asks first, and declining leaves the record alone', async ({ page }) => {
        await visit(page, 'inventory/categories');
        await search(page, RENAMED);

        await iconButton(row(page, RENAMED), 'trash').click();

        const confirm = dialog(page, 'Confirm');
        await expect(confirm).toBeVisible();
        await button(confirm, 'No').click();
        await expect(confirm).toBeHidden();

        await page.reload();
        await search(page, RENAMED);
        await expect(row(page, RENAMED)).toBeVisible();
    });

    test('confirming the delete removes it', async ({ page }) => {
        await visit(page, 'inventory/categories');
        await search(page, RENAMED);

        await iconButton(row(page, RENAMED), 'trash').click();

        const confirm = dialog(page, 'Confirm');
        await expect(confirm).toBeVisible();
        await button(confirm, 'Yes').click();
        await expect(confirm).toBeHidden();

        await expectToast(page, /deleted/i);
        await clearToasts(page);

        await page.reload();
        await page.getByPlaceholder('Search...').first().fill(RENAMED);
        await expect(row(page, RENAMED)).toHaveCount(0);
    });
});

test.describe.serial('suppliers', () => {
    // Suppliers, warehouses and shops are created through <app-quick-create-dialogs>, which is the
    // single path that enforces plan caps. The list page's New button delegates to it, so this
    // covers the shared component as well as the page.
    const NAME = uniqueName('Sup');
    const RENAMED = `${NAME} edited`;

    test('creating a supplier adds it to the list', async ({ page }) => {
        await visit(page, 'purchases/suppliers');
        await button(toolbar(page), 'New').click();

        const form = dialog(page, 'Supplier Details');
        await expect(form).toBeVisible();
        await form.locator('#name').fill(NAME);
        await save(page, form);

        await clearToasts(page);
        await search(page, NAME);
        await expect(row(page, NAME)).toBeVisible();
    });

    test('editing a supplier persists the change', async ({ page }) => {
        await visit(page, 'purchases/suppliers');
        await search(page, NAME);

        await iconButton(row(page, NAME), 'pencil').click();

        const form = dialog(page, 'Supplier Details');
        await expect(form.locator('#name')).toHaveValue(NAME);
        await form.locator('#name').fill(RENAMED);
        await save(page, form);

        await expectToast(page, /updated/i);
        await clearToasts(page);

        await page.reload();
        await search(page, RENAMED);
        await expect(row(page, RENAMED)).toBeVisible();
    });

    test('deleting a supplier removes it', async ({ page }) => {
        await visit(page, 'purchases/suppliers');
        await search(page, RENAMED);

        await iconButton(row(page, RENAMED), 'trash').click();

        const confirm = dialog(page, 'Confirm');
        await expect(confirm).toBeVisible();
        await button(confirm, 'Yes').click();
        await expect(confirm).toBeHidden();

        await expectToast(page, /deleted/i);
        await clearToasts(page);

        await page.reload();
        await page.getByPlaceholder('Search...').first().fill(RENAMED);
        await expect(row(page, RENAMED)).toHaveCount(0);
    });
});

test.describe.serial('warehouses', () => {
    const NAME = uniqueName('Wh');

    test('Cancel closes the dialog without creating anything', async ({ page }) => {
        await visit(page, 'inventory/warehouses');
        await button(toolbar(page), 'New').click();

        const form = dialog(page, 'New Warehouse');
        await expect(form).toBeVisible();
        await form.locator('#name').fill('E2E Abandoned Warehouse');
        await button(form, 'Cancel').click();
        await expect(form).toBeHidden();

        // Cancel has to mean cancel. A dialog that saves on the way out is the exact bug the
        // save-flow rewrite was chasing, and nothing else in the suite would notice it.
        await page.reload();
        await page.getByPlaceholder('Search...').first().fill('E2E Abandoned');
        await expect(row(page, 'E2E Abandoned')).toHaveCount(0);
    });

    test('creating a warehouse adds it to the list', async ({ page }) => {
        await visit(page, 'inventory/warehouses');
        await button(toolbar(page), 'New').click();

        const form = dialog(page, 'New Warehouse');
        await form.locator('#name').fill(NAME);
        await save(page, form);

        await clearToasts(page);
        await search(page, NAME);
        await expect(row(page, NAME)).toBeVisible();
    });

    test('deleting a warehouse removes it', async ({ page }) => {
        await visit(page, 'inventory/warehouses');
        await search(page, NAME);

        await iconButton(row(page, NAME), 'trash').click();

        const confirm = dialog(page, 'Confirm');
        await expect(confirm).toBeVisible();
        await button(confirm, 'Yes').click();
        await expect(confirm).toBeHidden();

        await expectToast(page, /deleted/i);
        await clearToasts(page);

        await page.reload();
        await page.getByPlaceholder('Search...').first().fill(NAME);
        await expect(row(page, NAME)).toHaveCount(0);
    });
});

test.describe('dialogs open on the heavier pages', () => {
    // No round trip here on purpose. Customers need a type, a CIN and a name; products carry the
    // largest form in the app. Pinning this suite to all of that would make it fail for reasons
    // that have nothing to do with a framework upgrade. What matters is that the control opens
    // its dialog and the dialog is populated — that is what breaks when pButton stops rendering.

    test('customers: New opens the form and refuses an empty save', async ({ page }) => {
        await visit(page, 'sales/customers');
        await button(toolbar(page), 'New').click();

        const form = dialog(page, 'Customer Details');
        await expect(form).toBeVisible();

        await button(form, 'Save').click();
        await expect(form).toBeVisible();

        await button(form, 'Cancel').click();
        await expect(dialog(page)).toBeHidden();
    });

    test('products: New opens the product form', async ({ page }, testInfo) => {
        const problems = watchForProblems(page);
        await visit(page, 'inventory/products');

        // The products toolbar is its own component rather than the shared .ims-page-actions.
        await page.getByRole('button', { name: 'New' }).first().click();

        await expect(dialog(page)).toBeVisible();
        await assertHealthy(problems, 'products new dialog', testInfo);
    });
});

test.describe('the New button opens its dialog', () => {
    /**
     * The primary action on every list page the suite does not cover in depth.
     *
     * Broad rather than deep on purpose. "New" is the most common labelled pButton in the app, and
     * the PrimeNG migration's failure mode is that such a button renders with no label at all — at
     * which point getByRole stops finding it and every one of these fails. That makes this the
     * cheapest possible net for the regression, one test per page.
     *
     * It asserts the dialog appears and stops there. Closing, validating and saving are covered
     * properly by the round trips above; repeating them here would buy little and cost minutes.
     */
    const PAGES: Array<{ name: string; path: string }> = [
        { name: 'product families', path: 'inventory/product-families' },
        { name: 'shops', path: 'inventory/shops' },
        { name: 'expenses', path: 'finance/expenses' },
        { name: 'payments', path: 'finance/payments' },
        { name: 'refunds', path: 'finance/refunds' },
        { name: 'purchase credits', path: 'finance/purchase-credits' },
        { name: 'financial documents', path: 'finance/financial-documents' },
        { name: 'purchases', path: 'purchases/purchases' },
        { name: 'purchase returns', path: 'purchases/purchase-returns' },
        { name: 'orders', path: 'sales/orders' },
        { name: 'sales returns', path: 'sales/returns' },
        { name: 'users', path: 'administration/users' },
    ];

    for (const p of PAGES) {
        test(p.name, async ({ page }, testInfo) => {
            const problems = watchForProblems(page);
            await visit(page, p.path);

            // .first(): a few of these pages carry a second New in an empty-state panel.
            await button(toolbar(page), 'New').first().click();

            // Transactional forms load suppliers, shops and tax rules before they draw.
            await expect(dialog(page).first()).toBeVisible({ timeout: 30_000 });

            await assertHealthy(problems, `${p.name} new dialog`, testInfo);
        });
    }
});

test.describe.serial('shops', () => {
    // The third of the quick-create entities, after suppliers and warehouses. Worth its own round
    // trip because quick-create is where the plan caps live, and shops are the one the POS needs.
    const NAME = uniqueName('Shop');

    test('creating a shop adds it to the list', async ({ page }) => {
        await visit(page, 'inventory/shops');
        await button(toolbar(page), 'New').first().click();

        const form = dialog(page, 'Shop Details');
        await expect(form).toBeVisible();
        await form.locator('#name').fill(NAME);
        await save(page, form);

        await clearToasts(page);
        await search(page, NAME);
        await expect(row(page, NAME)).toBeVisible();
    });

    test('deleting a shop removes it', async ({ page }) => {
        await visit(page, 'inventory/shops');
        await search(page, NAME);

        await iconButton(row(page, NAME), 'trash').click();

        const confirm = dialog(page, 'Confirm');
        await expect(confirm).toBeVisible();
        await button(confirm, 'Yes').click();
        await expect(confirm).toBeHidden();

        await clearToasts(page);
        await page.reload();
        await page.getByPlaceholder('Search...').first().fill(NAME);
        await expect(row(page, NAME)).toHaveCount(0);
    });
});

test.describe.serial('selecting rows and deleting them together', () => {
    /**
     * The other half of every list page's toolbar.
     *
     * Row checkboxes gate the Delete button — it is disabled until something is selected — so this
     * covers three things nothing else does: the checkbox renders and responds, selection reaches
     * the component, and the toolbar's second button works. All of it is PrimeNG table internals
     * driven through ARIA rather than class names, so it survives the re-skin.
     */
    const NAME = uniqueName('Bulk');

    test('a category to delete', async ({ page }) => {
        await visit(page, 'inventory/categories');
        await button(toolbar(page), 'New').click();

        const form = dialog(page, 'Category Details');
        await form.locator('#categoryName').fill(NAME);
        await save(page, form);

        await clearToasts(page);
        await search(page, NAME);
        await expect(row(page, NAME)).toBeVisible();
    });

    test('selecting it enables Delete, and confirming removes it', async ({ page }) => {
        await visit(page, 'inventory/categories');
        await search(page, NAME);

        const remove = button(toolbar(page), 'Delete');
        // Disabled until there is a selection: deleting nothing should not be offered.
        await expect(remove).toBeDisabled();

        await rowCheckbox(row(page, NAME)).click();
        await expect(remove).toBeEnabled();

        await remove.click();

        const confirm = dialog(page, 'Confirm');
        await expect(confirm).toBeVisible();
        await button(confirm, 'Yes').click();
        await expect(confirm).toBeHidden();

        await clearToasts(page);
        await page.reload();
        await page.getByPlaceholder('Search...').first().fill(NAME);
        await expect(row(page, NAME)).toHaveCount(0);
    });
});

test.describe.serial('products', () => {
    /**
     * The heaviest form in the app, and the only round trip here that needs fixtures.
     *
     * A physical item requires a category, a warehouse and a supplier before it can be saved, so
     * this creates all three, uses them, and takes them away again in reverse order. That is worth
     * the length: products are the entity everything else references, and this is the only spec
     * that drives three PrimeNG dropdowns and a currency input in one form.
     */
    const CATEGORY = uniqueName('PCat');
    const WAREHOUSE = uniqueName('PWh');
    const SUPPLIER = uniqueName('PSup');
    const NAME = uniqueName('Item');
    const REFERENCE = `E2E-${Date.now().toString().slice(-8)}`;

    /** A p-inputNumber has no id to aim at, so it is found by the label sitting above it. */
    function numberField(form: ReturnType<typeof dialog>, label: string) {
        return form.locator('div.field').filter({ hasText: label }).first().locator('input').first();
    }

    /** Opens a dropdown and picks an option by its visible text. */
    async function choose(page: Parameters<typeof dialog>[0], control: ReturnType<typeof dialog>, option: string) {
        await control.click();
        await page.getByRole('option', { name: option }).first().click();
    }

    test('fixtures: a category, a warehouse and a supplier', async ({ page }) => {
        for (const fixture of [
            { path: 'inventory/categories', header: 'Category Details', field: '#categoryName', value: CATEGORY },
            { path: 'inventory/warehouses', header: 'New Warehouse', field: '#name', value: WAREHOUSE },
            { path: 'purchases/suppliers', header: 'Supplier Details', field: '#name', value: SUPPLIER },
        ]) {
            await visit(page, fixture.path);
            await button(toolbar(page), 'New').first().click();

            const form = dialog(page, fixture.header);
            await expect(form).toBeVisible();
            await form.locator(fixture.field).fill(fixture.value);
            await save(page, form);
            await clearToasts(page);
        }
    });

    test('creating an item adds it to the list', async ({ page }) => {
        await visit(page, 'inventory/products');
        await page.getByRole('button', { name: 'New' }).first().click();

        const form = dialog(page, 'Item Details');
        await expect(form).toBeVisible();

        // Item Type already defaults to the physical item, which is the path that requires a
        // supplier, a warehouse and both prices. Asserted rather than selected: if the default ever
        // changes, the rest of this spec is filling in the wrong form.
        await expect(form.locator('div.field').filter({ hasText: 'Item Type' }).first()).toContainText('Item (physical)');
        await form.locator('input[name="name"]').fill(NAME);
        await form.locator('input[name="reference"]').fill(REFERENCE);

        await choose(page, form.locator('p-dropdown:has(#category)'), CATEGORY);
        await choose(page, form.locator('p-dropdown:has(#warehouse)'), WAREHOUSE);
        await choose(page, form.locator('p-dropdown:has(#supplier)'), SUPPLIER);

        await numberField(form, 'Buying Price').fill('10');
        await numberField(form, 'Selling Price').fill('20');

        await save(page, form);
        await clearToasts(page);

        await search(page, NAME);
        await expect(row(page, NAME)).toBeVisible();
    });

    test('deleting the item removes it', async ({ page }) => {
        await visit(page, 'inventory/products');
        await search(page, NAME);

        await iconButton(row(page, NAME), 'trash').first().click();

        const confirm = dialog(page, 'Confirm');
        await expect(confirm).toBeVisible();
        await button(confirm, 'Yes').click();
        await expect(confirm).toBeHidden();

        await clearToasts(page);
        await page.reload();
        await page.getByPlaceholder('Search...').first().fill(NAME);
        await expect(row(page, NAME)).toHaveCount(0);
    });

    test('fixtures removed', async ({ page }) => {
        for (const fixture of [
            { path: 'purchases/suppliers', value: SUPPLIER },
            { path: 'inventory/warehouses', value: WAREHOUSE },
            { path: 'inventory/categories', value: CATEGORY },
        ]) {
            await visit(page, fixture.path);
            await search(page, fixture.value);
            await iconButton(row(page, fixture.value), 'trash').first().click();

            const confirm = dialog(page, 'Confirm');
            await expect(confirm).toBeVisible();
            await button(confirm, 'Yes').click();
            await expect(confirm).toBeHidden();
            await clearToasts(page);
        }
    });
});
