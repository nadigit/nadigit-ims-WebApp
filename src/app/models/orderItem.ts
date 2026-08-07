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

  /** Selected sale-line options (components/cuts). Flat wire format: [{ lineOptionId }]. */
  selectedOptions?: { lineOptionId: number; code?: string; label?: string }[];
  /** Portion of a divisible unit sold (1 = whole, 0.5 = half, ...); scales PER_PORTION_FRACTION rules. */
  portionFraction?: number;
  /** Read-only: goods amount after line adjustments (rules), and the applied adjustments. */
  adjustedSubTotal?: number;
  lineAdjustmentsTotal?: number;
  adjustments?: { orderItemAdjustmentId?: number; ruleCode?: string; label?: string; amount: number }[];

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