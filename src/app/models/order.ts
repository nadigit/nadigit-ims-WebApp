import { Customer } from "./customer";
import { OrderItem, OrderItemCostInfo } from "./orderItem";
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
  /** Decimal snapshot used by backend (e.g. 0.2 for 20%). */
  taxRateUsed?: number;
  transportAmount?:number;
  additionalChargesAmount?: number;
  shop?: Shop;
  payments?: Array<Payment>;
  itemCount?: number;
  returns?: Array<OrderReturn>;
  hasInvoice?: boolean;
  
  // ⚠️ NEW FIELDS for payment terms and due dates
  paymentTermsDays?: number | null;        // Payment terms in days
  paymentDueDate?: Date | string;          // Calculated due date
  
  // ⚠️ NEW FIELDS for cost and profit calculation
  totalCost?: number;                      // Total cost of goods sold (COGS)
  totalProfit?: number;                   // Total profit (totalAmount - totalCost)
  profitMargin?: number;                  // Overall profit margin percentage (0-100)
  costBreakdown?: OrderItemCostInfo[];    // Detailed breakdown array with cost info per item
}