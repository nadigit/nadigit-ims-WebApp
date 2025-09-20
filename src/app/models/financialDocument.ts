import { Order } from "./order";

export interface FinancialDocument {
  financialDocId?: number;                // optional because backend generates it
  order?: Order;               // linked order
  docType?: string;      // enum
  docStatus?: string;     // enum
  docNumber?: string;          // e.g. INV-2025-0001
  docTitle?: string;          // optional
  createdBy?: string;
  createdAt?: string;         // ISO string (LocalDateTime from backend)
  issuedAt?: string;
  issuedBy?: string;
  canceledAt?: string;
  canceledBy?: string;
  fileUrl?: string;
}