/** Mirrors backend `LinePriceRuleDTO` and its enums. */
export type LinePriceRuleDocumentType = 'SALE' | 'BOTH';

/**
 * ALWAYS — apply unconditionally.
 * WHEN_SUPPRESSOR_ABSENT — skip when a premium option with "suppresses adjustments" is selected
 *   (the generic "lomo exception").
 * WHEN_OPTION_SELECTED / WHEN_OPTION_ABSENT — condition on a specific option code being chosen or not.
 */
export type LinePriceConditionKind =
  | 'ALWAYS'
  | 'WHEN_SUPPRESSOR_ABSENT'
  | 'WHEN_OPTION_SELECTED'
  | 'WHEN_OPTION_ABSENT';

export type LineAdjustmentKind = 'DEDUCTION' | 'SURCHARGE';

/** How the adjustment amount scales: flat, per unit, per portion fraction, or a percent of the line. */
export type LineAdjustmentBasis =
  | 'FLAT'
  | 'PER_DISPLAY_UNIT'
  | 'PER_PORTION_FRACTION'
  | 'PERCENT_OF_LINE';

/**
 * LITERAL — a fixed amount entered here.
 * PRODUCT_ATTRIBUTE — read the amount from a named product attribute.
 * CONSUMED_BATCH_VALUE — read the consumed batch's companion value (e.g. the entrails credit).
 */
export type LineAdjustmentAmountSource = 'LITERAL' | 'PRODUCT_ATTRIBUTE' | 'CONSUMED_BATCH_VALUE';

export interface LinePriceRule {
  linePriceRuleId?: number;
  code?: string;
  label?: string;
  active?: boolean;
  priority?: number;
  documentType?: LinePriceRuleDocumentType;

  /** Scope: applies to a specific product, a whole category, or all products when both are null. */
  productId?: number | null;
  categoryId?: number | null;

  /** Effective window (ISO date strings, inclusive). Null = open-ended. */
  validFrom?: string | null;
  validTo?: string | null;

  conditionKind?: LinePriceConditionKind;
  /** Required only for WHEN_OPTION_SELECTED / WHEN_OPTION_ABSENT. */
  conditionOptionCode?: string | null;

  adjustmentKind?: LineAdjustmentKind;
  basis?: LineAdjustmentBasis;
  amountSource?: LineAdjustmentAmountSource;
  /** Required for LITERAL; optional for PRODUCT_ATTRIBUTE; unused for CONSUMED_BATCH_VALUE. */
  amount?: number | null;
  /** Required for PRODUCT_ATTRIBUTE. */
  attributeName?: string | null;

  /** Read-only display fields resolved by the backend. */
  productName?: string | null;
  productReference?: string | null;
  categoryName?: string | null;
}
