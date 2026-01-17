import { Customer } from "./customer";

export type CreditStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'PENDING' | 'EXPIRED';

export class CustomerCreditAccount {
  creditAccountId?: number;
  customer?: Customer;
  creditBalance?: number;
  creditLimit?: number;
  totalCreditIssued?: number;
  totalCreditUsed?: number;
  status?: CreditStatus;
  creditTermsDays?: number;
  accountOpenedDate?: string;
  accountClosedDate?: string;
  lastTransactionDate?: string;
  notes?: string;
  creationDate?: string;
  createdBy?: string;
  lastModifiedDate?: string;
  lastModifiedBy?: string;
}

