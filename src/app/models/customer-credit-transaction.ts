import { CustomerCreditAccount } from "./customer-credit-account";
import { Order } from "./order";
import { Payment } from "./payment";
import { Refund } from "./refund";

export type CreditTransactionType = 
  | 'CREDIT_ISSUED' 
  | 'CREDIT_USED' 
  | 'CREDIT_EXPIRED' 
  | 'CREDIT_ADJUSTMENT' 
  | 'PAYMENT_APPLIED' 
  | 'REFUND_ISSUED';

export class CustomerCreditTransaction {
  transactionId?: number;
  creditAccount?: CustomerCreditAccount;
  transactionType?: CreditTransactionType;
  amount?: number; // Positive for issued, negative for used
  balanceBefore?: number;
  balanceAfter?: number;
  transactionDate?: string; // ISO date
  expirationDate?: string; // ISO date
  reference?: string;
  description?: string;
  notes?: string;
  order?: Order; // If linked to order
  payment?: Payment; // If linked to payment
  refund?: Refund; // If linked to refund
  financialDocument?: any; // If linked to credit note
  creationDate?: string; // ISO datetime
  createdBy?: string;
}

