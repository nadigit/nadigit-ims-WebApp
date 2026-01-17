// Product Import Models

export interface ImportOptions {
  skipDuplicates?: boolean; // Default: true
  updateExisting?: boolean; // Default: false
  createMissingCategories?: boolean; // Default: false
  createMissingSuppliers?: boolean; // Default: false
  createMissingWarehouses?: boolean; // Default: false
  defaultWarehouseId?: number;
  defaultCategoryId?: number;
  defaultSupplierId?: number;
  validateOnly?: boolean; // Default: false
  stopOnFirstError?: boolean; // Default: false
  batchSize?: number; // Default: 100
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

export interface ProductPreviewData {
  rowNumber: number;
  reference: string;
  name: string;
  category: string;
  supplier: string;
  warehouse: string;
  buyingPrice?: number;
  sellingPrice?: number;
  quantity?: number;
  status: "NEW" | "UPDATE" | "SKIP" | "ERROR";
  warnings: string[];
}

export interface ImportPreview {
  previewRowCount: number;
  totalRows: number;
  previewData: ProductPreviewData[];
  validationResult: ImportValidationResult;
  estimatedCreates: number;
  estimatedUpdates: number;
  estimatedSkips: number;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  durationMs: number;
  errors: ImportRowError[];
  generalErrors: string[];
  message: string;
  jobId?: string; // For async imports (future)
  async: boolean;
  fileName: string;
}

