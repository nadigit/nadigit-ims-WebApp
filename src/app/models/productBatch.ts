import { Supplier } from './supplier';

/**
 * ProductBatch model represents a batch/lot of a product with specific expiration date and quantity
 */
export interface ProductBatch {
  batchId?: number;
  productId: number;
  warehouseId?: number;
  batchNumber?: string | null;
  expirationDate: string; // ISO date string (YYYY-MM-DD)
  quantityAvailable: number;
  initialQuantity?: number;
  receiptDate?: string; // ISO date string
  buyingPrice?: number | null; // Optional buying price per unit for this batch (falls back to product buying price if null)
  supplier?: Supplier | null; // Optional supplier who provided this batch (falls back to product supplier if null)
  active?: boolean;
  sourceReference?: string | null; // Reference to purchase/order that created this batch
  sourceType?: string | null; // 'PURCHASE', 'RETURN', etc.
  sourceId?: number | null; // ID of the source purchase/order
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  lastModifiedBy?: string | null;
}

/**
 * Batch status based on expiration date
 */
export type BatchStatus = 'ACTIVE' | 'EXPIRED';

