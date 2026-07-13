/** Mirrors backend `TaxRuleDTO` / `TaxRuleDocumentType`. */
export type TaxRuleDocumentType = 'SALES' | 'PURCHASE' | 'BOTH';

export interface TaxRule {
  taxRuleId?: number;
  code?: string;
  label?: string;
  /** Decimal fraction, e.g. 0.2 for 20% */
  rate?: number;
  documentType?: TaxRuleDocumentType;
  priority?: number;
  active?: boolean;
  productId?: number | null;
  categoryId?: number | null;
  country?: string | null;
  /** Read-only display fields resolved by the backend. */
  productName?: string | null;
  productReference?: string | null;
  categoryName?: string | null;
  /** Optional effective window (ISO yyyy-MM-dd); null bounds are open-ended. */
  validFrom?: string | null;
  validTo?: string | null;
}
