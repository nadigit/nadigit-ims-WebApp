import { ReturnStatus } from "../enums/return-status.enum";
import { Purchase } from "./purchase";
import { PurchaseReturnItem } from "./purchaseReturnItem";
import { PurchaseCredit } from "./purchaseCredit";

export class PurchaseReturn { 
  returnId?: number;
  reference?: string;
  notes?: string;
  returnDate?: Date | string;
  purchase?: Purchase;
  totalCreditableAmount?: number;
  returnItems?: Array<PurchaseReturnItem>;
  returnStatus?: ReturnStatus;
  credits?: Array<PurchaseCredit>;
  createdBy?: string;
  creationDate?: Date;
}

