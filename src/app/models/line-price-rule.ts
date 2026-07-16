/** Mirrors backend `LinePriceRuleDTO` (Capability B — conditional line price adjustments). */
export type LinePriceRuleDocumentType = 'SALE' | 'BOTH';
export type LinePriceConditionKind =
  | 'ALWAYS'
  | 'WHEN_SUPPRESSOR_ABSENT'
  | 'WHEN_OPTION_SELECTED'
  | 'WHEN_OPTION_ABSENT';
export type LineAdjustmentKind = 'DEDUCTION' | 'SURCHARGE';
export type LineAdjustmentBasis = 'FLAT' | 'PER_DISPLAY_UNIT' | 'PER_PORTION_FRACTION' | 'PERCENT_OF_LINE';
export type LineAdjustmentAmountSource = 'LITERAL' | 'PRODUCT_ATTRIBUTE' | 'CONSUMED_BATCH_VALUE';

export interface LinePriceRule {
  linePriceRuleId?: number;
  code?: string;
  label?: string;
  active?: boolean;
  priority?: number;
  documentType?: LinePriceRuleDocumentType;
  productId?: number | null;
  categoryId?: number | null;
  /** Optional effective window (ISO yyyy-MM-dd); null bounds are open-ended. */
  validFrom?: string | null;
  validTo?: string | null;
  conditionKind?: LinePriceConditionKind;
  conditionOptionCode?: string | null;
  adjustmentKind?: LineAdjustmentKind;
  basis?: LineAdjustmentBasis;
  amountSource?: LineAdjustmentAmountSource;
  amount?: number | null;
  attributeName?: string | null;
  /** Read-only display fields resolved by the backend. */
  productName?: string | null;
  productReference?: string | null;
  categoryName?: string | null;
}
