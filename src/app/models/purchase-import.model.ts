// Purchase Import Models

export interface PurchaseImportOptions {
  skipDuplicates?: boolean; // Default: true
  updateExisting?: boolean; // Default: false
  createMissingSuppliers?: boolean; // Default: false
  createMissingProducts?: boolean; // Default: false
  defaultShopId?: number; // For admin users
  groupByInvoice?: boolean; // Default: true - Group rows with same invoice number
  groupBySupplierAndDate?: boolean; // Default: true - Fallback grouping
  validateInvoiceUniqueness?: boolean; // Default: false
  batchSize?: number; // Default: 100
  stopOnFirstError?: boolean; // Default: false
  // Phase 2 specific options
  parseInvoiceDocuments?: boolean; // Default: false (for Phase 1 compatibility)
  autoMatchProducts?: boolean; // Default: true
  productMatchThreshold?: number; // Default: 0.8 (0.0 to 1.0)
  requireManualReview?: boolean; // Default: false
  preferredLanguage?: string; // "en", "ar", "fr", "es", or null for auto-detect
}

export interface ImportRowError {
  rowNumber: number; // 1-based, including header
  column: string;
  message: string;
  invalidValue: string;
  severity: "ERROR" | "WARNING";
}

export interface ImportValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  errors: ImportRowError[];
  generalErrors: string[];
  fileFormat: string; // "CSV" or "XLSX"
  columnCount: number;
  detectedColumns: string[];
  missingColumns: string[];
}

export interface PurchaseItemPreview {
  rowNumber: number;
  productReference: string;
  productName?: string;
  quantityPurchased: number;
  buyingPrice: number;
  expirationDate?: string; // ISO date string
  batchNumber?: string;
  status: "NEW" | "ERROR" | "WARNING";
  warnings: string[];
  errors: string[];
}

export interface PurchaseGroupPreview {
  purchaseIndex: number;
  supplierName: string;
  supplierId?: number;
  dateOfPurchase: string; // ISO date string
  invoice?: string;
  purpose?: string;
  discount?: number;
  taxEnabled?: boolean;
  itemCount: number;
  totalAmount: number;
  items: PurchaseItemPreview[];
  status: "NEW" | "ERROR" | "WARNING";
  warnings: string[];
  errors: string[];
}

export interface PurchaseImportPreview {
  previewRowCount: number;
  totalRows: number;
  groupedPurchases: PurchaseGroupPreview[];
  validationResult: ImportValidationResult;
  estimatedPurchases: number;
  estimatedItems: number;
}

export interface PurchaseSummary {
  purchaseId: number;
  reference: string;
  supplierName: string;
  invoice?: string;
  itemCount: number;
  totalAmount: number;
}

export interface PurchaseImportResult {
  success: boolean;
  totalRows: number;
  purchasesCreated: number;
  itemsCreated: number;
  failed: number;
  errors: ImportRowError[];
  generalErrors: string[];
  createdPurchases: PurchaseSummary[];
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  durationMs: number;
  fileName: string;
  message: string;
}

// Phase 2: Parsed Invoice Data
export interface ParsedInvoiceData {
  invoiceNumber?: string;
  supplierName?: string;
  invoiceDate?: string; // ISO date string
  dueDate?: string; // ISO date string
  totalAmount?: number;
  taxAmount?: number;
  discount?: number;
  purpose?: string;
  currency?: string;
  items: ParsedInvoiceItem[];
  metadata: Record<string, string>; // Additional extracted data
  detectedLanguage: string; // "en", "ar", "fr", "es"
  confidence: number; // 0.0 to 1.0 - parsing confidence score
  warnings: string[];
  errors: string[];
}

export interface ParsedInvoiceItem {
  productReference?: string; // May be null if not matched
  productName: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  batchNumber?: string;
  expirationDate?: string; // ISO date string
  unitOfMeasure?: string;
  matchConfidence?: number; // 0.0 to 1.0 - product matching confidence
  matchedProductId?: number; // ID of matched product if auto-matched
}

// Product Mapping (for manual product matching)
export interface ProductMapping {
  invoiceProductName: string; // Product name as it appears in invoice
  productReference: string; // Product reference in system
  productId?: number; // Optional: product ID
  confidence?: number; // Optional: matching confidence
}

