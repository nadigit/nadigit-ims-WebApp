import { BankAccount } from './bank-account';

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'PAYMENT' | 'RECEIPT' | 'FEE' | 'INTEREST' | 'ADJUSTMENT';

export interface BankTransaction {
  transactionId?: number;
  account: BankAccount;
  type: TransactionType;
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  transactionDate: string; // ISO-8601 date
  recordedDate?: string; // ISO-8601 datetime
  reference?: string;
  description?: string;
  payment?: { paymentId: number };
  expense?: { id: number };
  relatedTransaction?: { transactionId: number };
  checkNumber?: string;
  bankReference?: string;
  reconciled?: boolean;
  reconciledDate?: string;
  reconciledBy?: string;
  notes?: string;
  createdBy?: string;
  creationDate?: string;
}

export interface AccountSummary {
  accountId: number;
  accountName: string;
  currentBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  startDate?: string;
  endDate?: string;
}

export interface TransactionFilter {
  startDate?: string;
  endDate?: string;
  type?: TransactionType;
  reconciled?: boolean;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

