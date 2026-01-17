import { PurchaseReturn } from "./purchaseReturn";
import { Payment } from "./payment";

export interface PurchaseCredit {
  creditId?: number;
  originalPayment?: Payment;
  purchaseReturn?: PurchaseReturn;
  amount?: number;
  creditDate?: Date | string;
  status?: string;
  creditMethod?: string; // CASH, TRANSFER, CHECK, BOE
  bankAccountId?: number;
  checkNumber?: string;
  checkExpirationDate?: Date | string;
  boeNumber?: string;
  boeExpirationDate?: Date | string;
  transactionReference?: string;
  notes?: string;
  createdBy?: string;
  creationDate?: Date;
  processingDate?: Date | string;
  transactionId?: string;
  lastUpdated?: Date | string;
}

