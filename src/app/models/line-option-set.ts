/** Mirrors backend `LineOptionSetDTO` / `LineOptionDTO` / `LineOptionSelectionMode`. */
export type LineOptionSelectionMode = 'SINGLE' | 'MULTI';

export interface LineOption {
  lineOptionId?: number;
  code?: string;
  label?: string;
  sortOrder?: number;
  defaultSelected?: boolean;
  /** When selected, waives conditional line price adjustments (the generic "lomo exception"). */
  suppressesAdjustments?: boolean;
  active?: boolean;
}

export interface LineOptionSet {
  lineOptionSetId?: number;
  code?: string;
  label?: string;
  selectionMode?: LineOptionSelectionMode;
  minSelect?: number;
  /** null = unlimited (subject to selectionMode). */
  maxSelect?: number | null;
  active?: boolean;
  /** Scope: a set applies to a specific product, or a whole category. */
  productId?: number | null;
  categoryId?: number | null;
  /** Read-only display fields resolved by the backend. */
  productName?: string | null;
  productReference?: string | null;
  categoryName?: string | null;
  options?: LineOption[];
}
