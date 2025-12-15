import { Bank } from './bank';

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CURRENT' | 'CREDIT_LINE' | 'TERM_DEPOSIT' | 'INVESTMENT';

export interface BankAccount {
  accountId?: number;
  bank: Bank;
  accountName: string;
  accountNumber?: string;
  routingNumber?: string;
  iban?: string;
  swiftCode?: string;
  accountType: AccountType;
  currency?: string;
  openingBalance: number;
  currentBalance?: number;
  minimumBalance?: number;
  creditLimit?: number;
  accountHolderName?: string;
  openingDate?: string;
  closingDate?: string;
  notes?: string;
  active?: boolean;
  creationDate?: string;
  createdBy?: string;
  lastModifiedDate?: string;
  lastModifiedBy?: string;
}

