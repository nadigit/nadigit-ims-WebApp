/**
 * An approved-vendor row: one supplier that can source a given product, with its terms.
 * `defaultVendor` is derived server-side (the lowest-priority active row) and mirrors
 * `product.supplier`, which is retained for backward compatibility.
 */
export interface ProductSupplier {
  productSupplierId?: number;
  productId?: number;
  supplierId?: number;
  supplierName?: string;
  supplierSku?: string | null;
  lastPurchasePrice?: number | null;
  leadTimeDays?: number | null;
  minOrderQty?: number | null;
  packSize?: number | null;
  priority?: number;
  active?: boolean;
  defaultVendor?: boolean;
  notes?: string | null;
  creationDate?: string;
  updatedDate?: string;
}
