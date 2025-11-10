import { Customer } from "./customer";
import { OrderItem } from "./orderItem";
import { OrderReturn } from "./orderReturn";
import { Payment } from "./payment";
import { Shop } from "./shop";


export class Order { 
  orderId?: number;
  reference?: string;
  orderStatus?: string;
  orderDate?: Date;
  expiryDate?: Date;
  processingDate?: Date;
  deliveryDate?: Date;
  cancelDate?: Date;
  completeDate?: Date;
  returnDate?: Date;
  returnPendingDate?: Date;
  totalAmount?: number;
  totalPaid?: number;
  totalRefunded?: number;
  customer?: Customer;
  orderItems?: Array<OrderItem>;
  paymentStatus?: string;
  creationDate?: Date;
  discount?:number;
  discountType?: string;
  taxEnabled?:boolean;
  dutyFreeAmount?:number;
  taxAmount?:number;
  transportAmount?:number;
  shop?: Shop;
  payments?: Array<Payment>;
  itemCount?: number;
  returns?: Array<OrderReturn>;
  hasInvoice?: boolean;
}