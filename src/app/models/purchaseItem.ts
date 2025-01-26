import { Purchase } from "./purchase";
import { Product } from "./product";

export class PurchaseItem { 
  id?: number;
  product?: Product; // Reference to the Product object
  purchase?: Purchase;
  quantityPurchased?: number;
  buyingPrice?: number;
  totalCost?: number;
}