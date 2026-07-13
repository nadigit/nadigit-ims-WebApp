import { ReturnStatus } from "../enums/return-status.enum";
import { Order } from "./order";
import { Refund } from "./refund";
import { ReturnItem } from "./returnItem";


export class OrderReturn {
  returnId?: number;
  reference?: string;
  notes?: string;
  returnDate?: Date | string;
  order?: Order;
  totalRefundableAmount?: number;
  returnItems?: Array<ReturnItem>;
  returnStatus?: ReturnStatus;
  refunds?: Array<Refund>;
  createdBy?: string;
  creationDate?: Date;
}

export interface OrderReturnDeleteImpactItem {
  type: string;
  count: number;
  blocking: boolean;
}

export interface OrderReturnDeleteImpact {
  returnId: number;
  returnReference?: string;
  canDelete: boolean;
  forceable: boolean;
  blockingReasonKey?: string;
  impacts: OrderReturnDeleteImpactItem[];
  totalCascadeRecords: number;
}