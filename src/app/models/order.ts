import { Customer } from "./customer";
import { OrderItem } from "./orderItem";
import { Shop } from "./shop";


export class Order { 
  orderId?: number;
  orderStatus?: string;
  orderDate?: Date;
  processingDate?: Date;
  deliveryDate?: Date;
  cancelDate?: Date;
  completeDate?: Date;
  returnDate?: Date;
  totalAmount?: number;  
  customer?: Customer;
  orderItems?: Array<OrderItem>;
  paymentMethod?: string;
  checkNumber?: string;
  checkExpirationDate?: Date | string;
  boeNumber?: string;
  boeExpirationDate?: Date | string;
  creationDate?: Date;
  discount?:number;
  discountType?: string;
  taxEnabled?:boolean;
  shop?: Shop;
}