import { RefundMethod } from '../enums/refund-method.enum';
import { RefundStatus } from '../enums/refund-status.enum';
import { OrderReturn } from './orderReturn';
import { Payment } from './payment';

export interface Refund {
  refundId?: number;
  originalPayment?: Payment;
  orderReturn?: OrderReturn;
  amount?: number;
  refundDate?: Date | string;
  status?: string;
  refundMethod?: string;
  bankAccountId?: number;
  checkNumber?: string;
  checkExpirationDate?: Date | string;
  boeNumber?: string;
  boeExpirationDate?: Date | string;
  notes?: string;
  createdBy?: string;
  creationDate?: Date;
  processingDate?: Date | string;
  transactionId?: string;
  customer?: any;
  lastUpdated?: Date | string;
  creditAmountIssued?: number; // Amount of credit issued from this refund (for non-cash methods)
}