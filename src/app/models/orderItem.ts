import { Order } from "./order";
import { Product } from "./product";

export class OrderItem { 
  orderItemId?: number;
  product?: Product; // Reference to the Product object
  order?: Order;
  quantity?: number;
  returnedQuantity?: number;
  subTotal?: number;
  pricePerUnit?: number;
  lineNetAmount?: number;
  lineTaxAmount?: number;
  lineGrossAmount?: number;
  /** Decimal snapshot used by backend (e.g. 0.2 for 20%). */
  taxRateUsed?: number;
  
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