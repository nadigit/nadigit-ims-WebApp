import { Order } from "./order";
import { Product } from "./product";

export class ReturnItem { 
  returnItemId?: number;
  product?: Product; // Reference to the Product object
  returnedQuantity?: number;
  refundAmount?: number;
}