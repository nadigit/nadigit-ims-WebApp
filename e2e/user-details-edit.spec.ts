import { expect, test } from '@playwright/test';
import { visit } from './helpers/page-health';

/**
 * Edit on a user's details page opens the real user form, filled with that user, and closing it
 * returns to the details page.
 *
 * The details page had a dialog of its own that only ever said "Loading user form…": the form was
 * never built there. Edit now opens the Users and Permissions form, the console's one user form.
 */
test('Edit on user details opens the filled user form and returns', async ({ page }) => {
  await visit(page, 'administration/users');
  await page.locator('.p-datatable-tbody tr').first().locator('.pi-eye').first().click();
  await page.waitForURL(/administration\/users\/[^/?]+$/, { timeout: 15_000 });
  const detailsUrl = page.url();

  await page.getByRole('button', { name: /^\s*Edit\s*$/ }).first().click();

  const form = page.locator('.p-dialog.user-dialog-shell').first();
  await expect(form).toBeVisible({ timeout: 20_000 });
  await expect(form).not.toContainText(/Loading user form|Chargement du formulaire/i);
  // Filled with the user, not a blank "new user" form.
  const username = form.locator('input[id*="username" i], input[name*="username" i]').first();
  await expect(username).not.toHaveValue('', { timeout: 15_000 });

  await form.getByRole('button', { name: /Cancel|Annuler/i }).first().click();
  await expect(page).toHaveURL(detailsUrl, { timeout: 15_000 });
});

// Opening an administrator's edit form from the list raised an error toast: the form looked the
// user's shop and warehouse up by id (shops/NaN for an administrator, a 500 for a stale id).
test('editing a user from the list makes no failing shop or warehouse lookups', async ({ page }) => {
  const failures: string[] = [];
  page.on('response', (r) => {
    if (/\/(shops|warehouses)\/[^/?]+$/.test(r.url()) && r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  await visit(page, 'administration/users');
  await page.locator('.p-datatable-tbody tr').first().locator('.pi-pencil').first().click();
  const form = page.locator('.p-dialog.user-dialog-shell').first();
  await expect(form).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('.p-toast-message-error')).toHaveCount(0);
  expect(failures).toEqual([]);
});

// The edit form pre-selects the user's current roles. It used to open with none ticked, so an
// administrator looked like a user needing a shop and warehouse, and saving would have cleared roles.
test('the edit form shows the user\'s current roles', async ({ page }) => {
  await visit(page, 'administration/users');
  const firstRow = page.locator('.p-datatable-tbody tr').first();
  const rolesCell = (await firstRow.innerText()).toLowerCase();
  await firstRow.locator('.pi-pencil').first().click();
  const form = page.locator('.p-dialog.user-dialog-shell').first();
  await expect(form).toBeVisible({ timeout: 20_000 });
  test.skip(!/admin|vendor|cashier|warehouse|accountant|auditor/.test(rolesCell), 'first user has no role to check');
  await expect(form.locator('input[type="checkbox"]:checked, .p-checkbox-checked').first()).toBeVisible({ timeout: 15_000 });
});
