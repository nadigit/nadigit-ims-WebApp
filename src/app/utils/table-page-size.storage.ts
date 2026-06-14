/** localStorage keys for persisted table page sizes (rows per page). */
export const TablePageSizeKeys = {
  products: 'products',
  productsArchived: 'products-archived',
  orders: 'orders',
  ordersProductsPicker: 'orders-products-picker',
  purchases: 'purchases',
  customers: 'customers',
  suppliers: 'suppliers',
  warehouses: 'warehouses',
  categories: 'categories',
  shops: 'shops',
  shopsPosSessions: 'shops-pos-sessions',
  shopsMovements: 'shops-movements',
  shopsInventory: 'shops-inventory',
  returns: 'returns',
  purchaseReturns: 'purchase-returns',
  financialDocuments: 'financial-documents',
  expenses: 'expenses',
  refunds: 'refunds',
  purchaseCredits: 'purchase-credits',
  users: 'users',
  bankingAccounts: 'banking-accounts',
  productFamilies: 'product-families',
  stockMovements: 'stock-movements',
  warehouseTransfers: 'warehouse-transfers',
  writeOffs: 'write-offs',
  salesPayments: 'sales-payments',
  purchasePayments: 'purchase-payments',
  inventorySnapshot: 'inventory-snapshot',
  inventorySnapshotDelta: 'inventory-snapshot-delta',
  settings: 'settings',
  backups: 'backups',
  backupsHistory: 'backups-history',
  auditLog: 'audit-log',
  taxRules: 'tax-rules',
  creditAccounts: 'credit-accounts',
  customerDetailsPriceOverrides: 'customer-details-price-overrides',
  customerDetailsOrders: 'customer-details-orders',
  customerDetailsReturns: 'customer-details-returns',
  customerDetailsPayments: 'customer-details-payments',
  supplierDetailsProducts: 'supplier-details-products',
  supplierDetailsPurchases: 'supplier-details-purchases',
  warehouseDetailsProducts: 'warehouse-details-products',
  categoryDetailsProducts: 'category-details-products',
  productDetailsMovements: 'product-details-movements',
  productDetailsBatches: 'product-details-batches',
  productDetailsWriteOffs: 'product-details-write-offs',
  shopDetailsSessions: 'shop-details-sessions',
  shopDetailsMovements: 'shop-details-movements',
  shopDetailsCashMovements: 'shop-details-cash-movements',
  shopDetailsProducts: 'shop-details-products',
  shopDetailsPosProducts: 'shop-details-pos-products',
  shopDetailsRecentExpenses: 'shop-details-recent-expenses',
  shopDetailsCollections: 'shop-details-collections',
  shopDetailsPosSessions: 'shop-details-pos-sessions',
  orderDetailsPayments: 'order-details-payments',
  purchaseDetailsPayments: 'purchase-details-payments',
  purchaseDetailsAttachments: 'purchase-details-attachments',
  returnDetailsItems: 'return-details-items',
  purchaseReturnDetailsItems: 'purchase-return-details-items',
  transferDetailsMovements: 'transfer-details-movements',
  financialDocumentDetailsLines: 'financial-document-details-lines',
  accountDetailsTransactions: 'account-details-transactions',
  paymentsTable: 'payments-table',
  creditReportsOutstanding: 'credit-reports-outstanding',
  creditReportsOverLimit: 'credit-reports-over-limit',
  bankingReconciliation: 'banking-reconciliation',
  treasuryCashRegisters: 'treasury-cash-registers',
  treasuryCashRegisterSessions: 'treasury-cash-register-sessions',
  treasuryCashRegisterMovements: 'treasury-cash-register-movements',
  treasuryCashRegisterCollections: 'treasury-cash-register-collections',
} as const;

export type TablePageSizeKey = (typeof TablePageSizeKeys)[keyof typeof TablePageSizeKeys];

const STORAGE_PREFIX = 'imsTablePageSize:';

export function getDefaultTablePageSize(allowedOptions: readonly number[]): number {
  if (allowedOptions.includes(20)) {
    return 20;
  }
  return allowedOptions[0] ?? 20;
}

export function getStoredTablePageSize(
  storageKey: string,
  allowedOptions: readonly number[],
  fallback?: number
): number {
  const defaultSize = fallback ?? getDefaultTablePageSize(allowedOptions);
  try {
    const saved = Number(localStorage.getItem(STORAGE_PREFIX + storageKey));
    return allowedOptions.includes(saved) ? saved : defaultSize;
  } catch {
    return defaultSize;
  }
}

export function storeTablePageSize(
  storageKey: string,
  allowedOptions: readonly number[],
  rows: number
): void {
  if (!allowedOptions.includes(rows)) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_PREFIX + storageKey, String(rows));
  } catch {
    // ignore quota / private browsing
  }
}

export function initTablePageSizeState(
  storageKey: string,
  allowedOptions: readonly number[],
  state: {
    pageSize?: number;
    rows?: number;
    lastLazyLoadEvent?: { rows?: number };
  },
  fallback?: number
): number {
  const size = getStoredTablePageSize(storageKey, allowedOptions, fallback);
  if (state.pageSize !== undefined) {
    state.pageSize = size;
  }
  if (state.rows !== undefined) {
    state.rows = size;
  }
  if (state.lastLazyLoadEvent) {
    state.lastLazyLoadEvent.rows = size;
  }
  return size;
}

export function persistTablePageSizeFromLazyEvent(
  storageKey: string,
  allowedOptions: readonly number[],
  event: { rows?: number | null },
  state: { pageSize?: number; rows?: number }
): void {
  if (event.rows == null || !allowedOptions.includes(event.rows)) {
    return;
  }
  if (state.pageSize !== undefined) {
    state.pageSize = event.rows;
  }
  if (state.rows !== undefined) {
    state.rows = event.rows;
  }
  storeTablePageSize(storageKey, allowedOptions, event.rows);
}

export function persistTablePageSizeFromPageEvent(
  storageKey: string,
  allowedOptions: readonly number[],
  event: { rows?: number | null },
  state: { pageSize: number }
): void {
  if (event.rows == null || !allowedOptions.includes(event.rows)) {
    return;
  }
  state.pageSize = event.rows;
  storeTablePageSize(storageKey, allowedOptions, event.rows);
}
