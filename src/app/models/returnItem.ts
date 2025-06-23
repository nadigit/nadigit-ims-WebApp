import { ItemCondition } from "../enums/item-condition.enum";
import { Order } from "./order";
import { OrderItem } from "./orderItem";
import { Product } from "./product";

export class ReturnItem { 
  returnItemId?: number;
  product?: Product;
  orderItem?: OrderItem;
  returnedQuantity?: number;
  refundAmount?: number;
  reason?:string;
  condition?: string;
}