import { BankTransaction } from 'src/app/models/bank-transaction';

export interface ReconciliationNavTarget {
  accountId: number;
  accountLabel: string;
}

/** Route commands for the reconciliation workspace of a bank account. */
export function bankReconciliationCommands(accountId: number): (string | number)[] {
  return ['/finance', 'banking', 'accounts', accountId, 'reconcile'];
}

/** Route commands for the bank accounts list (fallback when account id is unknown). */
export function bankingAccountsListCommands(): string[] {
  return ['/finance', 'banking', 'accounts'];
}

/**
 * Distinct bank accounts that still have unreconciled lines in this set of transactions.
 */
export function reconciliationNavTargetsFromTransactions(
  transactions: BankTransaction[] | null | undefined
): ReconciliationNavTarget[] {
  if (!transactions?.length) {
    return [];
  }
  const byId = new Map<number, string>();
  for (const t of transactions) {
    if (t.reconciled) {
      continue;
    }
    const id = t.account?.accountId;
    if (id == null) {
      continue;
    }
    const label = (t.account?.accountName || '').trim() || `#${id}`;
    if (!byId.has(id)) {
      byId.set(id, label);
    }
  }
  return [...byId.entries()].map(([accountId, accountLabel]) => ({ accountId, accountLabel }));
}
