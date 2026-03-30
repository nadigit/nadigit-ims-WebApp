import { Expense } from '../models/expense';

/**
 * Whether the expense may be edited in the UI.
 * Pending (and legacy rows with no status) may be edited; approved and rejected may not — backend also blocks editing rejected.
 * Deleting an approved expense remains available separately via {@link canDeleteExpenseByWorkflowStatus}.
 */
export function canEditExpenseByWorkflowStatus(expense: Expense | null | undefined): boolean {
  if (!expense) {
    return false;
  }
  const s = String(expense.status ?? '').toUpperCase().trim();
  if (s === 'REJECTED' || s === 'APPROVED') {
    return false;
  }
  return true;
}

/**
 * Whether the expense may be deleted from the UI. Backend supports delete for pending, approved,
 * and rejected (with cash/bank reversal rules). Use permissions + reconciliation to disable the control.
 */
export function canDeleteExpenseByWorkflowStatus(expense: Expense | null | undefined): boolean {
  return expense != null;
}
