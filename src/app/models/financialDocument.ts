import { Order } from "./order";
import { Payment } from "./payment";

export interface FinancialDocument {
  financialDocId?: number;                // optional because backend generates it
  order?: Order;               // linked order
  docType?: string;      // enum
  docStatus?: string;     // enum
  docNumber?: string;          // e.g. INV-2025-0001
  docTitle?: string; 
  dueDate?: Date | string;          // ISO string (LocalDate from backend)
  origin?: string;           // e.g. "Online Store", "In-Store", etc.
  payment?: Payment;         // linked payment if any
  createdBy?: string;
  createdAt?: string;         // ISO string (LocalDateTime from backend)
  issuedAt?: string;
  issuedBy?: string;
  canceledAt?: string;
  canceledBy?: string;
  fileUrl?: string;
  notes?: string;
  paymentTerms?: string;
  validityDays?: number;
  requiresSignature?: boolean;
  additionalReferences?: string;
}