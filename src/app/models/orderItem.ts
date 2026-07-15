import { OrderItemOptionSelection } from "./line-option-set";
import { Order } from "./order";
import { Product } from "./product";

export class OrderItem { 
  orderItemId?: number;
  product?: Product; // Reference to the Product object
  order?: Order;
  quantity?: number;
  /** Human-readable quantity for fractional/prepaid products (API). */
  displayQuantity?: number;
  displayReturnedQuantity?: number;
  displayRemainingQuantity?: number;
  returnedQuantity?: number;
  subTotal?: number;
  pricePerUnit?: number;
  lineNetAmount?: number;
  lineTaxAmount?: number;
  lineGrossAmount?: number;
  /** Decimal snapshot used by backend (e.g. 0.2 for 20%). */
  taxRateUsed?: number;
  /** Fraction of a unit represented by this line (e.g. 0.5 = half a carcass); default 1.0. */
  portionFraction?: number;
  /** Line options selected at sale time (Capability A of configurable sale pricing). */
  selectedOptions?: OrderItemOptionSelection[];
  /** Signed total of conditional line price adjustments (Capability B); negative = deduction. */
  lineAdjustmentsTotal?: number;
  /** Goods base after adjustments (read-only, backend-computed). */
  adjustedSubTotal?: number;
  /** Per-rule adjustment breakdown (read-only). */
  adjustments?: OrderItemAdjustment[];
}

/** Mirrors backend `OrderItemAdjustment` (Capability B breakdown row). */
export interface OrderItemAdjustment {
  orderItemAdjustmentId?: number;
  ruleCode?: string;
  label?: string;
  amount?: number;

  // ⚠️ NEW FIELDS for cost and profit calculation
  costPerUnit?: number;      // Cost per unit (from batches or price history)
  totalCost?: number;        // Total cost for this item (costPerUnit × quantity)
  profit?: number;           // Total profit for this item
  profitMargin?: number;     // Profit margin percentage for this item (0-100)
  profitPerUnit?: number;    // Profit per unit (pricePerUnit - costPerUnit)
}

// ⚠️ NEW INTERFACE for cost breakdown
export interface OrderItemCostInfo {
  productName: string;
  productReference: string;
  quantity: number;
  costPerUnit: number;
  totalCost: number;
  pricePerUnit: number;
  subTotal: number;
  profit: number;
  profitMargin: number;
  profitPerUnit: number;
}