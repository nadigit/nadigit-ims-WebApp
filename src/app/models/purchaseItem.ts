import { Purchase } from "./purchase";
import { Product } from "./product";

export class PurchaseItem { 
  purchaseItemId?: number;
  product?: Product; // Reference to the Product object
  purchase?: Purchase;
  quantityPurchased?: number;
  buyingPrice?: number;
  totalCost?: number;
  expirationDate?: string | null; // Optional expiration date for this batch/lot (ISO date string)
  batchNumber?: string | null; // Optional batch number for this purchase item
}