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
}