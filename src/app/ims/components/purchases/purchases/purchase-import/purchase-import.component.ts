import { Component, OnInit, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { MessageService } from 'primeng/api';
import { PurchaseImportService } from 'src/app/services/purchase-import.service';
import { PurchaseImportOptions, ImportValidationResult, PurchaseImportPreview, PurchaseImportResult, ImportRowError, PurchaseGroupPreview, ParsedInvoiceData, ParsedInvoiceItem, ProductMapping, InvoiceReviewLine, InvoiceReviewImportRequest } from 'src/app/models/purchase-import.model';
import { Shop } from 'src/app/models/shop';
import { Supplier } from 'src/app/models/supplier';
import { ShopService } from 'src/app/services/shop.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { ProductService } from 'src/app/services/product.service';
import { Product } from 'src/app/models/product';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { CategoryService } from 'src/app/services/category.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { Warehouse } from 'src/app/models/warehouse';

@Component({
  selector: 'app-purchase-import',
  templateUrl: './purchase-import.component.html',
  styleUrls: ['./purchase-import.component.css'],
  providers: [MessageService]
})
export class PurchaseImportComponent implements OnInit {
  @ViewChild('fileUpload') fileUpload: any;
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() importSuccess = new EventEmitter<void>();

  // File handling
  selectedFile: File | null = null;
  fileSizeLimit: number = 10 * 1024 * 1024; // 10MB

  // Import options
  importOptions: PurchaseImportOptions = {
    skipDuplicates: true,
    updateExisting: false,
    createMissingSuppliers: false,
    createMissingProducts: false,
    groupByInvoice: true,
    groupBySupplierAndDate: true,
    validateInvoiceUniqueness: false,
    batchSize: 100,
    stopOnFirstError: false,
    // Phase 2 options
    autoMatchProducts: true,
    productMatchThreshold: 0.8,
    preferredLanguage: undefined
  };

  // Dropdowns data
  shops: Shop[] = [];
  suppliers: Supplier[] = [];
  /** For assigning category when import creates missing products */
  categories: { categoryId: number; categoryName: string }[] = [];
  /** For assigning warehouse when import creates missing products */
  warehouses: Warehouse[] = [];
  isAdmin: boolean = false;

  // Loading states
  loading: boolean = false;
  validating: boolean = false;
  previewing: boolean = false;
  importing: boolean = false;

  // Results
  validationResult: ImportValidationResult | null = null;
  preview: PurchaseImportPreview | null = null;
  importResult: PurchaseImportResult | null = null;

  // UI state
  currentStep: 'upload' | 'validation' | 'preview' | 'import' | 'results' = 'upload';
  showAdvancedOptions: boolean = false;
  showHelpGuide: boolean = false;
  previewRowCount: number = 10;
  expandedPurchases: Set<number> = new Set();
  currency: string = 'USD';
  activeTab: number | undefined = 0; // 0 for file, 1 for invoice
  Math = Math; // Expose Math to template

  // Phase 2: Invoice Import
  selectedInvoiceFile: File | null = null;
  invoicePreviewUrl: string | null = null;
  preferredLanguage: string = ''; // Empty for auto-detect
  parsedInvoiceData: ParsedInvoiceData | null = null;
  productMappings: Record<string, string> = {}; // Map invoice product name to product reference
  parsingInvoice: boolean = false;
  searchingProducts: boolean = false;
  productSearchResults: Product[] = [];
  productSearchQuery: string = '';
  selectedItemForMatching: ParsedInvoiceItem | null = null;
  showProductSearchDialog: boolean = false;

  invoiceReviewStep: boolean = false;
  reviewSupplierName: string = '';
  reviewInvoiceNumber: string = '';
  reviewDateOfPurchase: Date | null = null;
  reviewDiscount: number = 0;
  reviewTaxEnabled: boolean = false;
  invoiceReviewLines: InvoiceReviewLine[] = [];

  constructor(
    private purchaseImportService: PurchaseImportService,
    private shopService: ShopService,
    private supplierService: SupplierService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private warehouseService: WarehouseService,
    private keycloakService: KeycloakService,
    private messageService: MessageService,
    private translate: TranslateService,
    private configService: AppConfigurationService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadInitialData();
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
  }

  async loadInitialData(): Promise<void> {
    try {
      const [shops, suppliers] = await Promise.all([
        firstValueFrom(this.shopService.getShops()),
        firstValueFrom(this.supplierService.getSuppliers())
      ]);

      this.shops = shops as Shop[];
      this.suppliers = suppliers as Supplier[];

      const token = await this.keycloakService.getToken();
      this.categoryService.jwt = token;
      this.warehouseService.jwt = token;
      const [cats, whs] = await Promise.all([
        firstValueFrom(this.categoryService.getCategories()),
        firstValueFrom(this.warehouseService.getWarehouses())
      ]);
      this.categories = Array.isArray(cats) ? (cats as { categoryId: number; categoryName: string }[]) : [];
      this.warehouses = Array.isArray(whs) ? (whs as Warehouse[]) : [];
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  setAdminStatus(isAdmin: boolean): void {
    this.isAdmin = isAdmin;
  }

  closeDialog(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.resetState();
  }

  resetState(): void {
    this.selectedFile = null;
    this.currentStep = 'upload';
    this.validationResult = null;
    this.preview = null;
    this.importResult = null;
    this.expandedPurchases.clear();
    this.activeTab = 0;
    // Phase 2 reset
    this.selectedInvoiceFile = null;
    this.invoicePreviewUrl = null;
    this.parsedInvoiceData = null;
    this.productMappings = {};
    this.preferredLanguage = '';
    this.selectedItemForMatching = null;
    this.showProductSearchDialog = false;
    this.productSearchResults = [];
    this.productSearchQuery = '';
    this.invoiceReviewStep = false;
    this.reviewSupplierName = '';
    this.reviewInvoiceNumber = '';
    this.reviewDateOfPurchase = null;
    this.reviewDiscount = 0;
    this.reviewTaxEnabled = false;
    this.invoiceReviewLines = [];
    this.importOptions = {
      skipDuplicates: true,
      updateExisting: false,
      createMissingSuppliers: false,
      createMissingProducts: false,
      groupByInvoice: true,
      groupBySupplierAndDate: true,
      validateInvoiceUniqueness: false,
      batchSize: 100,
      stopOnFirstError: false,
      autoMatchProducts: true,
      productMatchThreshold: 0.8,
      preferredLanguage: undefined
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
      await this.purchaseImportService.downloadTemplate(format);
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
        await this.purchaseImportService.validateImportFile(this.selectedFile, this.importOptions)
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
      this.preview = await firstValueFrom(
        await this.purchaseImportService.previewImport(this.selectedFile, this.previewRowCount, this.importOptions)
      );
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
        await this.purchaseImportService.executeImport(this.selectedFile, this.importOptions)
      );
      this.currentStep = 'results';

      if (this.importResult.success) {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('import_completed_successfully')
        });
        this.importSuccess.emit();
      } else {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('import_completed_with_errors'),
          detail: this.translate.instant('some_rows_failed')
        });
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
      this.purchaseImportService.downloadErrorReport(this.importResult.errors);
    } else if (this.validationResult?.errors && this.validationResult.errors.length > 0) {
      this.purchaseImportService.downloadErrorReport(this.validationResult.errors);
    }
  }

  togglePurchaseExpansion(purchaseIndex: number): void {
    if (this.expandedPurchases.has(purchaseIndex)) {
      this.expandedPurchases.delete(purchaseIndex);
    } else {
      this.expandedPurchases.add(purchaseIndex);
    }
  }

  isPurchaseExpanded(purchaseIndex: number): boolean {
    return this.expandedPurchases.has(purchaseIndex);
  }

  hasExpirationDate(items: any[]): boolean {
    return items && items.some((i: any) => i.expirationDate);
  }

  hasBatchNumber(items: any[]): boolean {
    return items && items.some((i: any) => i.batchNumber);
  }

  getStatusSeverity(status: string): string {
    switch (status) {
      case 'NEW':
        return 'success';
      case 'ERROR':
        return 'danger';
      case 'WARNING':
        return 'warning';
      default:
        return 'secondary';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'NEW':
        return this.translate.instant('new');
      case 'ERROR':
        return this.translate.instant('error');
      case 'WARNING':
        return this.translate.instant('warning');
      default:
        return status;
    }
  }

  getErrorSeverity(severity: string): string {
    return severity === 'ERROR' ? 'danger' : 'warning';
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

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  private toIsoDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  viewPurchase(purchaseId: number): void {
    this.router.navigate(['/inventory/purchases', purchaseId]);
    this.closeDialog();
  }

  // Phase 2: Invoice Import Methods
  onInvoiceFileSelect(event: any): void {
    const file = event.files?.[0];
    if (file) {
      const validTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!validTypes.includes(fileExtension)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_invoice_file_type')
        });
        return;
      }

      if (file.size > this.fileSizeLimit) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('file_too_large')
        });
        return;
      }

      this.selectedInvoiceFile = file;
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.invoicePreviewUrl = e.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        this.invoicePreviewUrl = null;
      }
    }
  }

  onInvoiceFileRemove(): void {
    this.selectedInvoiceFile = null;
    if (this.invoicePreviewUrl) {
      URL.revokeObjectURL(this.invoicePreviewUrl);
      this.invoicePreviewUrl = null;
    }
  }

  async parseInvoice(): Promise<void> {
    if (!this.selectedInvoiceFile) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_select_file')
      });
      return;
    }

    try {
      this.parsingInvoice = true;
      this.parsedInvoiceData = await firstValueFrom(
        await this.purchaseImportService.parseInvoice(
          this.selectedInvoiceFile,
          this.preferredLanguage || undefined
        )
      );
      this.normalizeParsedInvoiceItemPrices(this.parsedInvoiceData);
      this.currentStep = 'preview';
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('invoice_parsed_successfully')
      });
    } catch (error: any) {
      console.error('Error parsing invoice:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error.error?.message || this.translate.instant('error_parsing_invoice')
      });
    } finally {
      this.parsingInvoice = false;
    }
  }

  async searchProducts(query: string): Promise<void> {
    if (!query || query.length < 2) {
      this.productSearchResults = [];
      return;
    }

    try {
      this.searchingProducts = true;
      const products = await firstValueFrom(
        this.productService.searchProductsForPurchase(query)
      ) as Product[];
      this.productSearchResults = products || [];
    } catch (error) {
      console.error('Error searching products:', error);
      this.productSearchResults = [];
    } finally {
      this.searchingProducts = false;
    }
  }

  selectProductForMatching(item: ParsedInvoiceItem, product: Product): void {
    this.productMappings[item.productName] = product.reference || '';
    this.showProductSearchDialog = false;
    this.selectedItemForMatching = null;
    this.productSearchQuery = '';
    this.productSearchResults = [];
  }

  removeProductMapping(item: ParsedInvoiceItem): void {
    delete this.productMappings[item.productName];
  }

  getProductMatchStatus(item: ParsedInvoiceItem): { status: string; icon: string; color: string } {
    if (item.productReference) {
      return { status: 'matched', icon: '✅', color: 'green' };
    }
    if (this.productMappings[item.productName]) {
      return { status: 'mapped', icon: '🔗', color: 'blue' };
    }
    return { status: 'unmatched', icon: '⚠️', color: 'red' };
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.5) return 'yellow';
    return 'red';
  }

  getLanguageName(lang: string): string {
    const names: Record<string, string> = {
      'en': this.translate.instant('english'),
      'ar': this.translate.instant('arabic'),
      'fr': this.translate.instant('french'),
      'es': this.translate.instant('spanish')
    };
    return names[lang] || lang;
  }

  /**
   * Invoice parse warnings from the API are fixed English strings (see InvoiceParserServiceImpl).
   */
  private static readonly INVOICE_WARNING_I18N_KEYS: Record<string, string> = {
    'No product lines matched the automatic table parser. Totals and header fields may still be usable; map products manually in preview or use CSV import for complex layouts.':
      'purchase_invoice_warn_no_table_lines',
    'Text was extracted via OCR (scanned or image-based PDF). Verify all lines carefully.':
      'purchase_invoice_warn_ocr_pdf',
    'Very little text found in this PDF. If it is a scanned invoice, ensure Tesseract OCR is installed on the server (set TESSDATA_PREFIX or -Dtesseract.datapath). Otherwise use CSV/Excel import.':
      'purchase_invoice_warn_little_text_tesseract',
  };

  translateInvoiceOrImportWarning(text: string): string {
    const raw = (text || '').trim();
    const i18nKey = PurchaseImportComponent.INVOICE_WARNING_I18N_KEYS[raw];
    if (i18nKey) {
      const localized = this.translate.instant(i18nKey);
      return localized !== i18nKey ? localized : text;
    }
    return text;
  }

  async previewParsedInvoice(): Promise<void> {
    if (!this.selectedInvoiceFile || !this.parsedInvoiceData) {
      return;
    }

    try {
      this.previewing = true;
      this.preview = await firstValueFrom(
        await this.purchaseImportService.previewParsedInvoice(
          this.selectedInvoiceFile,
          this.productMappings,
          {
            ...this.importOptions,
            preferredLanguage: this.preferredLanguage || undefined
          }
        )
      );
      this.currentStep = 'preview';
    } catch (error: any) {
      console.error('Error previewing parsed invoice:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error.error?.message || this.translate.instant('error_previewing_import')
      });
    } finally {
      this.previewing = false;
    }
  }

  /**
   * Ensures each parsed line has unit (buying) and default selling prices for display/editing.
   * Derives unit from total/qty when the parser only filled line totals.
   */
  private normalizeParsedInvoiceItemPrices(data: ParsedInvoiceData | null): void {
    if (!data?.items?.length) {
      return;
    }
    for (const item of data.items) {
      let price = item.unitPrice != null ? item.unitPrice : 0;
      if ((!price || price <= 0) && item.totalPrice != null && item.quantity != null && item.quantity > 0) {
        price = item.totalPrice / item.quantity;
      }
      item.unitPrice = price;
      let selling = item.sellingPrice != null ? item.sellingPrice : 0;
      if (!selling || selling <= 0) {
        item.sellingPrice = price > 0 ? price * 1.5 : 1.0;
      }
      if (
        this.importOptions.createMissingProducts &&
        (item.categoryId == null || item.categoryId === undefined) &&
        this.importOptions.defaultCategoryId != null &&
        this.importOptions.defaultCategoryId !== undefined
      ) {
        item.categoryId = this.importOptions.defaultCategoryId;
      }
    }
  }

  goToInvoiceReview(): void {
    if (!this.parsedInvoiceData?.items?.length) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('purchase_invoice_no_lines')
      });
      return;
    }
    const d = this.parsedInvoiceData;
    this.reviewSupplierName = d.supplierName ?? '';
    this.reviewInvoiceNumber = d.invoiceNumber ?? '';
    this.reviewDateOfPurchase = d.invoiceDate ? new Date(d.invoiceDate) : null;
    this.reviewDiscount = d.discount ?? 0;
    if (d.taxEnabled != null) {
      this.reviewTaxEnabled = d.taxEnabled;
    } else {
      this.reviewTaxEnabled = d.taxAmount != null && d.taxAmount > 0;
    }
    this.invoiceReviewLines = d.items.map((item) => {
      const ref = (item.productReference || this.productMappings[item.productName] || '').trim();
      const qty = item.quantity != null && item.quantity > 0 ? item.quantity : 1;
      let price = item.unitPrice ?? 0;
      if ((!price || price <= 0) && item.totalPrice != null && item.quantity != null && item.quantity > 0) {
        price = item.totalPrice / item.quantity;
      }
      const exp = item.expirationDate ? new Date(item.expirationDate) : null;
      let selling = item.sellingPrice != null ? item.sellingPrice : 0;
      if (!selling || selling <= 0) {
        selling = price > 0 ? price * 1.5 : 1.0;
      }
      return {
        productName: item.productName,
        productReference: ref,
        quantityPurchased: qty,
        buyingPrice: price,
        sellingPrice: selling,
        categoryId:
          item.categoryId != null && item.categoryId !== undefined
            ? item.categoryId
            : (this.importOptions.defaultCategoryId ?? null),
        batchNumber: item.batchNumber ?? '',
        expirationDate: exp && !isNaN(exp.getTime()) ? exp : null
      };
    });
    this.invoiceReviewStep = true;
  }

  backFromInvoiceReview(): void {
    this.invoiceReviewStep = false;
  }

  applyDefaultCategoryToAllReviewLines(): void {
    const id = this.importOptions.defaultCategoryId ?? null;
    this.invoiceReviewLines.forEach((l) => {
      l.categoryId = id;
    });
  }

  addInvoiceReviewLine(): void {
    this.invoiceReviewLines.push({
      productName: '',
      productReference: '',
      quantityPurchased: 1,
      buyingPrice: 0,
      sellingPrice: 1.0,
      categoryId: this.importOptions.defaultCategoryId ?? null,
      batchNumber: '',
      expirationDate: null
    });
  }

  removeInvoiceReviewLine(index: number): void {
    this.invoiceReviewLines.splice(index, 1);
  }

  async executeInvoiceReview(): Promise<void> {
    if (this.isAdmin && (this.importOptions.defaultShopId == null || this.importOptions.defaultShopId === undefined)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('purchase_invoice_default_shop_required')
      });
      return;
    }
    const invalid = this.invoiceReviewLines.some(
      (l) =>
        !l.productReference?.trim() ||
        l.quantityPurchased == null ||
        l.quantityPurchased <= 0 ||
        l.buyingPrice == null ||
        l.buyingPrice < 0
    );
    if (invalid || this.invoiceReviewLines.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('purchase_invoice_review_validation')
      });
      return;
    }

    const payload: InvoiceReviewImportRequest = {
      supplierName: this.reviewSupplierName?.trim() || undefined,
      invoiceNumber: this.reviewInvoiceNumber?.trim() || undefined,
      dateOfPurchase: this.reviewDateOfPurchase ? this.toIsoDateOnly(this.reviewDateOfPurchase) : undefined,
      discount: this.reviewDiscount,
      taxEnabled: this.reviewTaxEnabled,
      createMissingSuppliers: !!this.importOptions.createMissingSuppliers,
      createMissingProducts: !!this.importOptions.createMissingProducts,
      defaultShopId: this.importOptions.defaultShopId ?? null,
      defaultCategoryId: this.importOptions.defaultCategoryId ?? null,
      defaultWarehouseId: this.importOptions.defaultWarehouseId ?? null,
      lines: this.invoiceReviewLines.map((l) => {
        const buy = Number(l.buyingPrice);
        let sell = Number(l.sellingPrice);
        if (isNaN(sell) || sell <= 0) {
          sell = buy > 0 ? buy * 1.5 : 1.0;
        }
        const row: InvoiceReviewImportRequest['lines'][number] = {
          productReference: l.productReference.trim(),
          productName: l.productName?.trim() || undefined,
          quantityPurchased: Math.max(1, Math.floor(Number(l.quantityPurchased))),
          buyingPrice: buy,
          sellingPrice: sell,
          batchNumber: l.batchNumber?.trim() || undefined,
          expirationDate:
            l.expirationDate && !isNaN(l.expirationDate.getTime())
              ? this.toIsoDateOnly(l.expirationDate)
              : undefined
        };
        if (this.importOptions.createMissingProducts && l.categoryId != null && l.categoryId !== undefined) {
          row.categoryId = l.categoryId;
        }
        return row;
      })
    };

    try {
      this.importing = true;
      const obs = await this.purchaseImportService.importFromInvoiceReview(payload);
      this.importResult = await firstValueFrom(obs);

      if (this.importResult.success) {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('import_completed_successfully')
        });
        this.importSuccess.emit();
        this.invoiceReviewStep = false;
        this.parsedInvoiceData = null;
        this.productMappings = {};
      } else {
        const msg =
          this.importResult.generalErrors?.join('; ') ||
          this.importResult.message ||
          this.translate.instant('import_completed_with_errors');
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('import_completed_with_errors'),
          detail: msg
        });
      }
    } catch (error: any) {
      const body = error?.error;
      if (body && typeof body.success === 'boolean') {
        this.importResult = body as PurchaseImportResult;
        const msg =
          this.importResult.generalErrors?.join('; ') ||
          this.importResult.message ||
          this.translate.instant('error_executing_import');
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: msg
        });
      } else {
        console.error('Error executing invoice review import:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: error.error?.message || this.translate.instant('error_executing_import')
        });
      }
    } finally {
      this.importing = false;
    }
  }

  /**
   * Translate error messages from backend
   * Also extracts invalid values for display
   */
  translateErrorMessage(message: string, error?: any): string {
    if (!message) return message;

    // Check for "Error processing row:" first and handle recursively
    let rowProcessingMatch = message.match(/Error processing row:\s*(.+)/i);
    if (rowProcessingMatch) {
      const errorDetail = rowProcessingMatch[1].trim();
      const translatedDetail = this.translateErrorMessage(errorDetail, error);
      return this.translate.instant('error_processing_row', { detail: translatedDetail });
    }

    // Supplier not found errors
    let supplierMatch = message.match(/Supplier not found:\s*(.+?)(?:\.|\s+Enable)/i);
    if (supplierMatch) {
      const supplierName = supplierMatch[1].trim();
      if (error && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = supplierName;
      }
      return this.translate.instant('error_supplier_not_found', { supplier: supplierName });
    }

    // Product not found errors
    let productMatch = message.match(/Product not found:\s*(.+?)(?:\.|\s+Enable)/i) ||
                       message.match(/Product reference (.+?) not found/i);
    if (productMatch) {
      const productRef = productMatch[1].trim();
      if (error && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = productRef;
      }
      return this.translate.instant('error_product_not_found', { product: productRef });
    }

    // Invalid price errors
    let priceMatch = message.match(/Invalid (?:buying)?\s*price:\s*(.+)/i) ||
                     message.match(/Price must be greater than 0/i);
    if (priceMatch) {
      const value = priceMatch[1] ? priceMatch[1].trim() : '';
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

    // Quantity errors
    let quantityMatch = message.match(/Invalid quantity:\s*(.+)/i) ||
                        message.match(/Quantity must be a positive number/i);
    if (quantityMatch) {
      const value = quantityMatch[1] ? quantityMatch[1].trim() : '';
      if (error && value && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = value;
      }
      return value ?
        this.translate.instant('error_invalid_quantity', { value: value }) :
        this.translate.instant('error_quantity_must_be_positive');
    }

    // Invoice uniqueness errors
    let invoiceMatch = message.match(/Invoice (.+?) already exists/i);
    if (invoiceMatch) {
      const invoice = invoiceMatch[1].trim();
      if (error && (!error.invalidValue || error.invalidValue === '')) {
        error.invalidValue = invoice;
      }
      return this.translate.instant('error_duplicate_invoice', { invoice: invoice });
    }

    // If no pattern matches, return original message
    return message;
  }
}

