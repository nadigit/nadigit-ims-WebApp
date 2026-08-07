/** One row of the global batch-expiry overview (mirrors backend BatchExpiryDTO). */
export interface BatchExpiryRow {
  batchId: number;
  batchNumber?: string | null;
  productId: number;
  productName?: string;
  warehouseId?: number | null;
  warehouseName?: string | null;
  expirationDate?: string; // ISO date
  quantityAvailable: number;
  daysUntilExpiration: number;
  status: 'EXPIRED' | 'EXPIRING_SOON';
}
