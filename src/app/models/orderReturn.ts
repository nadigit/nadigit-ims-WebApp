import { Order } from "./order";
import { ReturnItem } from "./returnItem";


export class OrderReturn { 
  returnId?: number;
  reason?: string;
  notes?: string;
  returnDate?: Date;
  order?: Order;
  refundAmount?: number;  
  returnItems?: Array<ReturnItem>;
  creationDate?: Date;
}