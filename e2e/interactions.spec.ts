import { test, expect } from '@playwright/test';
import { assertHealthy, visit, watchForProblems } from './helpers/page-health';
import {
    button,
    clearToasts,
    dialog,
    expectToast,
    iconButton,
    row,
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
