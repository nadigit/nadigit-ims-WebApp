import { Component, OnInit, ViewChild, Output, EventEmitter } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ProductImportService } from 'src/app/services/product-import.service';
import { ImportOptions, ImportValidationResult, ImportPreview, ImportResult, ImportRowError, ProductPreviewData } from 'src/app/models/product-import.model';
import { Category } from 'src/app/models/category';
import { Warehouse } from 'src/app/models/warehouse';
import { Supplier } from 'src/app/models/supplier';
import { CategoryService } from 'src/app/services/category.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-product-import',
  templateUrl: './product-import.component.html',
  styleUrls: ['./product-import.component.css'],
  providers: [MessageService]
})
export class ProductImportComponent implements OnInit {
  @ViewChild('fileUpload') fileUpload: any;
  @Output() importSuccess = new EventEmitter<ImportResult>();

  // Dialog visibility
  importDialogVisible: boolean = false;

  // File handling
  selectedFile: File | null = null;
  fileSizeLimit: number = 10 * 1024 * 1024; // 10MB

  // Import options
  importOptions: ImportOptions = {
    skipDuplicates: true,
    updateExisting: false,
    createMissingCategories: false,
    createMissingSuppliers: false,
    createMissingWarehouses: false,
    batchSize: 100,
    stopOnFirstError: false
  };

  // Dropdowns data
  categories: Category[] = [];
  warehouses: Warehouse[] = [];
  suppliers: Supplier[] = [];

  // Loading states
  loading: boolean = false;
  validating: boolean = false;
  previewing: boolean = false;
  importing: boolean = false;

  // Results
  validationResult: ImportValidationResult | null = null;
  preview: ImportPreview | null = null;
  importResult: ImportResult | null = null;

  // UI state
  currentStep: 'upload' | 'validation' | 'preview' | 'import' | 'results' = 'upload';
  showAdvancedOptions: boolean = false;
  showHelpGuide: boolean = false;
  /** Max rows to ask the preview API to analyze (full file for accurate counts; capped for safety) */
  private static readonly PREVIEW_ROWS_MAX = 50000;

  previewRowCount: number = 10;

  constructor(
    private productImportService: ProductImportService,
    private categoryService: CategoryService,
    private warehouseService: WarehouseService,
    private supplierService: SupplierService,
    private messageService: MessageService,
    private translate: TranslateService
  ) { }

  ngOnInit(): void {
    this.loadInitialData();
  }

  async loadInitialData(): Promise<void> {
    try {
      // Load categories, warehouses, and suppliers for default dropdowns
      const [categories, warehouses, suppliers] = await Promise.all([
        firstValueFrom(this.categoryService.getCategories()),
        firstValueFrom(this.warehouseService.getWarehouses()),
        firstValueFrom(this.supplierService.getSuppliers())
      ]);

      this.categories = categories as Category[];
      this.warehouses = warehouses as Warehouse[];
      this.suppliers = suppliers as Supplier[];
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  openDialog(): void {
    this.importDialogVisible = true;
    this.resetState();
  }

  closeDialog(): void {
    this.importDialogVisible = false;
    this.resetState();
  }

  resetState(): void {
    this.selectedFile = null;
    this.currentStep = 'upload';
    this.validationResult = null;
    this.preview = null;
    this.importResult = null;
    this.importOptions = {
      skipDuplicates: true,
      updateExisting: false,
      createMissingCategories: false,
      createMissingSuppliers: false,
      createMissingWarehouses: false,
      batchSize: 100,
      stopOnFirstError: false
    };
    if (this.fileUpload) {
      this.fileUpload.clear();
    }
  }

  onFileSelect(event: any): void {
    const file = event.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['.csv', '.xlsx', '.xls'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!validTypes.includes(fileExtension)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_file_type')
        });
        return;
      }

      // Validate file size
      if (file.size > this.fileSizeLimit) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('file_too_large')
        });
        return;
      }

      this.selectedFile = file;
    }
  }

  onFileRemove(): void {
    this.selectedFile = null;
  }

  async downloadTemplate(format: 'csv' | 'excel'): Promise<void> {
    try {
      this.loading = true;
      await this.productImportService.downloadTemplate(format);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('template_downloaded_successfully')
      });
    } catch (error) {
      console.error('Error downloading template:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_downloading_template')
      });
    } finally {
      this.loading = false;
    }
  }

  async validateFile(): Promise<void> {
    if (!this.selectedFile) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_select_file')
      });
      return;
    }

    try {
      this.validating = true;
      this.validationResult = await firstValueFrom(
        this.productImportService.validateFile(this.selectedFile, this.importOptions)
      );

      if (this.validationResult.valid) {
        this.currentStep = 'validation';
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('file_validated_successfully')
        });
      } else {
        this.currentStep = 'validation';
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('validation_errors_found'),
          detail: this.translate.instant('please_review_errors')
        });
      }
    } catch (error: any) {
      console.error('Error validating file:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error.error?.message || this.translate.instant('error_validating_file')
      });
    } finally {
      this.validating = false;
    }
  }

  async previewImport(): Promise<void> {
    if (!this.selectedFile) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_select_file')
      });
      return;
    }

    try {
      this.previewing = true;
      const totalFromValidation = this.validationResult?.totalRows;
      const previewRowsRequest =
        totalFromValidation != null && totalFromValidation > 0
          ? Math.min(Math.max(totalFromValidation, 1), ProductImportComponent.PREVIEW_ROWS_MAX)
          : this.previewRowCount;
      this.preview = await firstValueFrom(
        this.productImportService.previewImport(this.selectedFile, previewRowsRequest, this.importOptions)
      );
      this.normalizePreviewEstimates(this.preview);
      this.currentStep = 'preview';
    } catch (error: any) {
      console.error('Error previewing import:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error.error?.message || this.translate.instant('error_previewing_import')
      });
    } finally {
      this.previewing = false;
    }
  }

  async executeImport(): Promise<void> {
    if (!this.selectedFile) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_select_file')
      });
      return;
    }

    try {
      this.importing = true;
      this.currentStep = 'import';
      this.importResult = await firstValueFrom(
        this.productImportService.executeImport(this.selectedFile, this.importOptions)
      );
      this.currentStep = 'results';

      if (this.importResult.success) {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('import_completed_successfully')
        });
        // Emit import success event to parent component
        this.importSuccess.emit(this.importResult);
      } else {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('import_completed_with_errors'),
          detail: this.translate.instant('some_rows_failed')
        });
        // Also emit if there were some successful imports (created > 0 or updated > 0)
        if ((this.importResult.created || 0) > 0 || (this.importResult.updated || 0) > 0) {
          this.importSuccess.emit(this.importResult);
        }
      }
    } catch (error: any) {
      console.error('Error executing import:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error.error?.message || this.translate.instant('error_executing_import')
      });
    } finally {
      this.importing = false;
    }
  }

  downloadErrorReport(): void {
    if (this.importResult?.errors && this.importResult.errors.length > 0) {
      this.productImportService.downloadErrorReport(this.importResult.errors);
    } else if (this.validationResult?.errors && this.validationResult.errors.length > 0) {
      this.productImportService.downloadErrorReport(this.validationResult.errors);
    }
  }

  getStatusSeverity(status: string): string {
    switch (status) {
      case 'NEW':
        return 'success';
      case 'UPDATE':
        return 'info';
      case 'SKIP':
        return 'warning';
      case 'ERROR':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'NEW':
        return this.translate.instant('new');
      case 'UPDATE':
        return this.translate.instant('update');
      case 'SKIP':
        return this.translate.instant('skip');
      case 'ERROR':
        return this.translate.instant('error');
      default:
        return status;
    }
  }

  getErrorSeverity(severity: string): string {
    return severity === 'ERROR' ? 'danger' : 'warning';
  }

  /**
   * Some APIs return estimatedCreates/Updates/Skips only for the first N preview rows while totalRows is file-wide.
   * If totals still look sample-sized, scale from the status mix in previewData to totalRows.
   */
  private normalizePreviewEstimates(preview: ImportPreview): void {
    const rows = preview.previewData || [];
    const sampleLen = rows.length;
    const total = preview.totalRows ?? 0;
    if (sampleLen === 0 || total === 0) {
      return;
    }

    const c = preview.estimatedCreates ?? 0;
    const u = preview.estimatedUpdates ?? 0;
    const s = preview.estimatedSkips ?? 0;
    const sum = c + u + s;

    if (!(total > sampleLen && sum <= sampleLen)) {
      return;
    }

    let nNew = 0;
    let nUpd = 0;
    let nSkip = 0;
    let nErr = 0;
    for (const row of rows) {
      switch (row.status) {
        case 'NEW':
          nNew++;
          break;
        case 'UPDATE':
          nUpd++;
          break;
        case 'SKIP':
          nSkip++;
          break;
        case 'ERROR':
          nErr++;
          break;
        default:
          break;
      }
    }
    const denom = nNew + nUpd + nSkip + nErr;
    if (denom === 0) {
      return;
    }

    let estC = Math.round((nNew / denom) * total);
    let estU = Math.round((nUpd / denom) * total);
    const errPart = Math.round((nErr / denom) * total);
    let estS = Math.round((nSkip / denom) * total) + errPart;

    let drift = total - estC - estU - estS;
    if (drift !== 0) {
      if (nNew >= nUpd && nNew >= nSkip && nNew >= nErr) {
        estC += drift;
      } else if (nUpd >= nSkip && nUpd >= nErr) {
        estU += drift;
      } else {
        estS += drift;
      }
    }

    preview.estimatedCreates = estC;
    preview.estimatedUpdates = estU;
    preview.estimatedSkips = estS;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Translate error messages from backend
   * Also extracts invalid values for display
   */
  translateErrorMessage(message: string, error?: any): string {
    if (!message) return message;

    // Check for "Error processing row:" or "Error processing row X:" first and handle recursively
    let rowProcessingMatch = message.match(/Error processing row(?:\s+(\d+))?:\s*(.+)/i);
    if (rowProcessingMatch) {
      const rowNumber = rowProcessingMatch[1] || '';
      const errorDetail = rowProcessingMatch[2].trim();
      // Try to translate the detail recursively
      const translatedDetail = this.translateErrorMessage(errorDetail, error);
      if (rowNumber) {
        return this.translate.instant('error_processing_row_with_number', { row: rowNumber, detail: translatedDetail });
      } else {
        return this.translate.instant('error_processing_row', { detail: translatedDetail });
      }
    }

    // Category not found errors
    let categoryMatch = message.match(/Category not found:\s*(.+?)(?:\.|\s+Enable)/i);
    if (categoryMatch) {
      const categoryName = categoryMatch[1].trim();
      // Update invalidValue if error object is provided and invalidValue is empty
      if (error && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = categoryName;
      }
      return this.translate.instant('error_category_not_found', { category: categoryName });
    }

    // Supplier not found errors
    let supplierMatch = message.match(/Supplier not found:\s*(.+?)(?:\.|\s+Enable)/i);
    if (supplierMatch) {
      const supplierName = supplierMatch[1].trim();
      // Update invalidValue if error object is provided and invalidValue is empty
      if (error && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = supplierName;
      }
      return this.translate.instant('error_supplier_not_found', { supplier: supplierName });
    }

    // Warehouse not found errors
    let warehouseMatch = message.match(/Warehouse not found:\s*(.+?)(?:\.|\s+Enable)/i);
    if (warehouseMatch) {
      const warehouseName = warehouseMatch[1].trim();
      // Update invalidValue if error object is provided and invalidValue is empty
      if (error && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = warehouseName;
      }
      return this.translate.instant('error_warehouse_not_found', { warehouse: warehouseName });
    }

    // Duplicate reference errors
    let duplicateMatch = message.match(/Duplicate reference:\s*(.+)/i) || 
                         message.match(/Reference (.+?) already exists/i);
    if (duplicateMatch) {
      const reference = duplicateMatch[1].trim();
      // Update invalidValue if error object is provided and invalidValue is empty
      if (error && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = reference;
      }
      return this.translate.instant('error_duplicate_reference', { reference: reference });
    }

    // Invalid price errors
    let priceMatch = message.match(/Invalid (?:selling|buying)?\s*price:\s*(.+)/i) ||
                     message.match(/Price must be greater than 0/i);
    if (priceMatch) {
      const value = priceMatch[1] ? priceMatch[1].trim() : '';
      // Update invalidValue if error object is provided and invalidValue is empty
      if (error && value && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = value;
      }
      return value ? 
        this.translate.instant('error_invalid_price', { value: value }) :
        this.translate.instant('error_price_must_be_positive');
    }

    // Invalid date format errors
    let dateMatch = message.match(/Invalid date format:\s*(.+)/i) ||
                    message.match(/Date must be in format YYYY-MM-DD/i);
    if (dateMatch) {
      const value = dateMatch[1] ? dateMatch[1].trim() : '';
      // Update invalidValue if error object is provided and invalidValue is empty
      if (error && value && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = value;
      }
      return value ?
        this.translate.instant('error_invalid_date_format', { value: value }) :
        this.translate.instant('error_date_format_required');
    }

    // Required field errors
    let requiredMatch = message.match(/(.+?) is required/i);
    if (requiredMatch) {
      const field = requiredMatch[1].trim();
      return this.translate.instant('error_field_required', { field: field });
    }

    // Invalid measure unit errors
    let unitMatch = message.match(/Invalid measure unit:\s*(.+)/i);
    if (unitMatch) {
      const unit = unitMatch[1].trim();
      // Update invalidValue if error object is provided and invalidValue is empty
      if (error && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = unit;
      }
      return this.translate.instant('error_invalid_measure_unit', { unit: unit });
    }

    // Invalid product type errors
    let typeMatch = message.match(/Invalid product type:\s*(.+)/i);
    if (typeMatch) {
      const type = typeMatch[1].trim();
      // Update invalidValue if error object is provided and invalidValue is empty
      if (error && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = type;
      }
      return this.translate.instant('error_invalid_product_type', { type: type });
    }

    // Missing required column errors
    let columnMatch = message.match(/Missing required column:\s*(.+)/i);
    if (columnMatch) {
      const column = columnMatch[1].trim();
      return this.translate.instant('error_missing_required_column', { column: column });
    }

    // Quantity errors
    let quantityMatch = message.match(/Invalid quantity:\s*(.+)/i) ||
                        message.match(/Quantity must be a positive number/i);
    if (quantityMatch) {
      const value = quantityMatch[1] ? quantityMatch[1].trim() : '';
      // Update invalidValue if error object is provided and invalidValue is empty
      if (error && value && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = value;
      }
      return value ?
        this.translate.instant('error_invalid_quantity', { value: value }) :
        this.translate.instant('error_quantity_must_be_positive');
    }

    // If no pattern matches, return original message
    return message;
  }
}

