import { Customer } from "./customer";
import { OrderItem } from "./orderItem";

export class Order { 
  orderId?: number;
  orderStatus?: string;
  orderDate?: Date;
  processingDate?: Date;
  deliveryDate?: Date;
  cancelDate?: Date;
  returnDate?: Date;
  totalAmount?: number;  
  customer?: Customer;
  orderItems?: Array<OrderItem>;
  paymentMethod?: string;
  creationDate?: Date;
}