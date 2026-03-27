import { Shop } from "./shop";

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ExpenseAttachment {
  id: number;
  fileUrl: string;
  originalFilename?: string;
  contentType?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface ExpenseConfig {
  requireApproval: boolean;
}

export class Expense {
  id?: number;
  purpose?: string;
  dateOfExpense?: Date | string;
  amount?: number;
  creationDate?: Date;
  receipt?: string;
  paymentMethod?: string;
  checkNumber?: string;
  checkExpirationDate?: Date | string;
  boeNumber?: string;
  boeExpirationDate?: Date | string;
  shop?: Shop;
  /** Backend workflow status */
  status?: ExpenseStatus | string;
  description?: string;
  lastUpdated?: Date | string;
  submissionDate?: Date | string;
  approvalDate?: Date | string;
  /** May be returned by API instead of or in addition to approvalDate */
  approvedDate?: string;
  approvedBy?: string;
  reimbursementDate?: Date | string;
  reimbursedBy?: string;
  approvalNotes?: string;
  rejectedBy?: string;
  rejectedDate?: string;
  rejectionReason?: string;
  createdBy?: string;
  bankAccountId?: number;
  attachments?: ExpenseAttachment[];
}
