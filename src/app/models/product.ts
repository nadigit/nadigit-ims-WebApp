import { Category } from "./category";
import { Supplier } from "./supplier";
import { Warehouse } from "./warehouse";
import { OrderItem } from "./orderItem";


export class Product {
  [x: string]: any; 
  productId?: number;
  reference?: string;
  name?: string;
  description?: string;
  quantityAvailable?: number;
  buyingPrice?: number;
  buyingDate?: Date;
  sellingPrice?: number;
  inventoryStatus?: string;
  productImage?:string;
  category?: Category;
  supplier?: Supplier;
  warehouse?: Warehouse;
  creationDate?: Date;

  orderItemQuantity?: number;
  orderItemPricePerUnit?: number;

  purchaseItemQuantity?: number;
  purchaseItemPricePerUnit?: number;

  returnItemQuantity?: number;
  returnItemPricePerUnit?: number;

  returnItemReason?: string;
  returnItemCondition?: string;

  orderItem?: OrderItem;
}