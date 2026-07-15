/** Mirrors backend `LineOptionSetDTO` / `LineOptionDTO`. */
export type LineOptionSelectionMode = 'SINGLE' | 'MULTI';

export interface LineOption {
  lineOptionId?: number;
  code?: string;
  label?: string;
  sortOrder?: number;
  defaultSelected?: boolean;
  /** Premium option that waives line price adjustments when selected (e.g. lomo). */
  suppressesAdjustments?: boolean;
  active?: boolean;
}

/** A line option selected on an order/POS line — mirrors backend `OrderItemOption` (flat wire format). */
export interface OrderItemOptionSelection {
  orderItemOptionId?: number;
  lineOptionId?: number;
  /** Read-only display fields resolved by the backend. */
  code?: string;
  label?: string;
  suppressesAdjustments?: boolean;
}

export interface LineOptionSet {
  lineOptionSetId?: number;
  code?: string;
  label?: string;
  selectionMode?: LineOptionSelectionMode;
  minSelect?: number;
  maxSelect?: number | null;
  active?: boolean;
  productId?: number | null;
  categoryId?: number | null;
  /** Read-only display fields resolved by the backend. */
  productName?: string | null;
  productReference?: string | null;
  categoryName?: string | null;
  options?: LineOption[];
}
