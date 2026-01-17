import { Order } from "./order";
import { Payment } from "./payment";

export interface FinancialDocument {
  financialDocId?: number;                // optional because backend generates it
  order?: Order;               // linked order
  docType?: string;      // enum
  docStatus?: string;     // enum
  docNumber?: string;          // e.g. INV-2025-0001
  docTitle?: string; 
  documentDate?: Date | string;          // ISO string (LocalDate from backend) - NEW
  dueDate?: Date | string;          // ISO string (LocalDate from backend)
  deliveryDate?: Date | string;     // NEW
  validityStartDate?: Date | string; // NEW
  validityEndDate?: Date | string;   // NEW
  origin?: string;           // e.g. "Online Store", "In-Store", etc.
  payment?: Payment;         // linked payment if any
  createdBy?: string;
  createdAt?: Date | string;         // ISO string (LocalDateTime from backend)
  issuedAt?: Date | string;
  issuedBy?: string;
  canceledAt?: Date | string;
  canceledBy?: string;
  fileUrl?: string;
  notes?: string;
  paymentTerms?: string;
  paymentTermsDays?: number;  // NEW - Auto-calculates dueDate
  validityDays?: number;
  requiresSignature?: boolean;
  additionalReferences?: string;
  allocations?: PaymentAllocation[];  // NEW - For payment history display
}

export interface PaymentAllocation {
  payment: {
    paymentDate: string;
    paymentMethod: string;
    paymentStatus: 'SETTLED' | 'PENDING' | 'FAILED';
    transactionId?: string;
    checkNumber?: string;
  };
  allocatedAmount: number;
}

export enum DocumentType {
  QUOTE = 'QUOTE',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  DELIVERY_NOTE = 'DELIVERY_NOTE',
  RETURN_NOTE = 'RETURN_NOTE',
  PROFORMA_INVOICE = 'PROFORMA_INVOICE',
  INVOICE = 'INVOICE',
  CREDIT_NOTE = 'CREDIT_NOTE',
  RECEIPT = 'RECEIPT'
}

export enum DocumentOrigin {
  BACK_OFFICE = 'BACK_OFFICE',
  POS = 'POS',
  ONLINE_STORE = 'ONLINE_STORE'
}