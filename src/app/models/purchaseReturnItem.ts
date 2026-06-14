import { ItemCondition } from "../enums/item-condition.enum";
import { Purchase } from "./purchase";
import { PurchaseItem } from "./purchaseItem";
import { Product } from "./product";

export class PurchaseReturnItem { 
  returnItemId?: number;
  product?: Product;
  purchaseItem?: PurchaseItem;
  returnedQuantity?: number;
  displayReturnedQuantity?: number;
  refundAmount?: number;
  creditAmount?: number; // Alias for refundAmount in purchase returns
  reason?: string;
  condition?: string;
}

