import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { MessageService, LazyLoadEvent, MenuItem } from 'primeng/api';
import { Table } from 'primeng/table';
import { PurchaseService } from 'src/app/services/purchase.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Purchase } from 'src/app/models/purchase';
import { Shop } from 'src/app/models/shop';
import { ShopService } from 'src/app/services/shop.service';
import { Supplier } from 'src/app/models/supplier';
import { SupplierService } from 'src/app/services/supplier.service';
import { ProductService } from 'src/app/services/product.service';
import { Product } from 'src/app/models/product';
import { PurchaseItem } from 'src/app/models/purchaseItem';
import { Category } from 'src/app/models/category';
import { Warehouse } from 'src/app/models/warehouse';
import { CategoryService } from 'src/app/services/category.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import {
  calculateProfit,
  displayAttributeValue,
  getLowStockThreshold,
  getMeasureUnit,
  getQuantitySeverity,
  buildPurchaseItemPayload,
  lineQuantityStep,
  lineQuantityDecimals,
  lineQuantityMin as lineQtyMin,
  defaultLineQuantity,
  formatLineQuantity as formatLineQty,
  getLineMeasureUnit,
  displayProductStockQuantity,
} from 'src/app/shared/product-utils';
import { QuantityScale } from 'src/app/utils/quantity-scale.util';
import { getProductVariantSummary as buildProductVariantSummary, isFashionVariantMissing as isFashionVariantMissingUtil } from 'src/app/shared/variant-summary.utils';
import { firstValueFrom, lastValueFrom, Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { BankAccount } from 'src/app/models/bank-account';
import { PaymentValidationService } from 'src/app/services/payment-validation.service';
import { PaymentService } from 'src/app/services/payment.service';
import { Payment } from 'src/app/models/payment';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { ProcessModeService } from 'src/app/services/process-mode.service';
import { ActivityProfileService } from 'src/app/services/activity-profile.service';
import { DatePipe } from '@angular/common';
import {
  initTablePageSizeState,
  persistTablePageSizeFromLazyEvent,
  TablePageSizeKeys,
} from 'src/app/utils/table-page-size.storage';

interface LazyLoadEventExt extends LazyLoadEvent {
  globalFilter?: string;
  filters?: { [field: string]: any };
}

import { resolvePublicAssetUrl } from 'src/app/shared/product-image.utils';

@Component({
  templateUrl: './purchases.component.html',
  styleUrls: ['./purchases.component.css', '../purchases.component.css'],
  providers: [MessageService, DatePipe]
})
export class PurchasesComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {

  /** Display-ready URL for a category's stored (relative) image. */
  categoryImageUrl(category: any): string {
    return resolvePublicAssetUrl(category?.categoryImage);
  }

  @ViewChild('pickList') pickList: ElementRef | undefined;
  @ViewChild('purchaseImport') purchaseImport: any;

  Ressource: string = 'PURCHASES';

  purchaseDialog: boolean = false;

  deletePurchaseDialog: boolean = false;

  deletePurchasesDialog: boolean = false;

  purchases: Purchase[] = [];

  purchase: Purchase = {};

  shops: Shop[] = [];

  shop: Shop = {};

  products: Product[] = [];

  product: Product = {};

  suppliers: Supplier[] = [];

  supplier: Supplier = {};

  categories: Category[] = [];

  warehouses: Warehouse[] = [];

  canAddCategory: boolean = false;
  canAddSupplier: boolean = false;
  canAddWarehouse: boolean = false;

  selectedPurchases: Purchase[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  currency: any;

  statuses: any[] = [];
  paymentStatuses: any[] = [];

  // Filter properties
  selectedPurchaseStatus: string | null = null;
  selectedPaymentStatus: string | null = null;
  selectedSupplier: Supplier | null = null;
  selectedShop: Shop | null = null;
  startDate: Date | null = null;
  endDate: Date | null = null;

  rowsPerPageOptions = [20, 50, 100];
  pageSize = 20;

  expandedRows: { [key: string]: boolean } = {}; // Keep track of expanded rows

  valSwitch: boolean = false;

  sourceProducts: Product[] = [];

  targetProducts: Product[] = [];

  purchaseItems: PurchaseItem[] = [];

  exportColumns!: ExportColumn[];

  barcode: string = '';

  scanTimeout: any;

  scanning: boolean = true;

  private readonly barcodeIdleMs = 120;
  private readonly barcodeMinLength = 4;
  private lastBarcodeKeyAt = 0;

  TaxEnabledOptions: any[] = [];
  discountType: 'Amount' | 'Percentage' = 'Amount';
  discountTypeOptions: any[] = [];

  taxEnabled: boolean = false;

  taxRate: number = 0.0;

  canAddPurchase: boolean = false;
  canEditPurchase: boolean = false;
  canDeletePurchase: boolean = false;
  canReadPurchase: boolean = false;
  canProcessPurchase: boolean = false;
  canCancelPurchase: boolean = false;
  canImportPurchase: boolean = false;
  importDialogVisible: boolean = false;
  isLoading: boolean = true;
  isExporting: boolean = false;
  exportProgress: string = '';
  userRoles: any;
  isAdmin: boolean = false;
  maxPurchaseDate: any;

  purchaseDocumentChainMode = false;

  private static readonly URL_PURCHASE_STATUSES = ['PENDING', 'APPROVED', 'RECEIVED', 'COMPLETED'] as const;

  purchaseDialogDocumentChainSteps: MenuItem[] = [];
  purchaseDialogDocumentChainActiveIndex = 0;
  
  // Lazy loading properties
  totalRecords: number = 0;
  // Summary KPIs (from the purchases list response)
  purchasesTotalAmount: number = 0;
  purchasesTotalPaid: number = 0;
  purchasesRemainingBalance: number = 0;
  globalFilter: string = '';
  lastLazyLoadEvent: LazyLoadEvent = {
    first: 0,
    rows: 20,
    sortField: 'dateOfPurchase',
    sortOrder: -1
  };


  /** Product detail dialog selection (separate from purchase-line picker). */
  selectedProduct: Product | null = null;

  /** Purchase dialog: server-backed product picker (same UX pattern as orders). */
  purchasePickerFilteredProducts: Product[] = [];
  purchasePickerProductSuggestions: Product[] = [];
  purchasePickerProductSuggestionsLoading = false;
  purchasePickerSelectedProduct: Product | null = null;
  private latestPurchaseSuggestionToken = 0;

  purchasePickerCategories: Category[] = [];
  selectedPurchasePickerCategory: Category | null = null;
  filteredPurchasePickerCategories: Category[] = [];

  quickPurchaseProducts: Product[] = [];
  purchasePickerGridLoading = false;
  totalPurchasePickerGridRecords = 0;

  lastPurchasePickerLazyLoad: LazyLoadEventExt = {
    first: 0,
    rows: 24,
    sortField: 'name',
    sortOrder: 1,
    globalFilter: '',
    filters: {}
  };
  productDetailDialog: boolean = false;
  canAddProduct: boolean = false;
  canAddShop: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canArchiveProduct: boolean = false;
  canReadProduct: boolean = false;
  lowStockThreshold;
  productDialog: boolean = false;
  deleteProductDialog: boolean = false;
  archiveProductDialog: boolean = false;
  imagePreviewUrl: string | null = null;
  isImageLoading: boolean = false;
  isDragOver: boolean = false;
  imageZoomDialog: boolean = false;
  recentProductImages: string[] = [];
  isSaving: boolean = false;
  uploadProgress: number = 0;
  existingImageFile: any = null;
  imageURL: any;
  uploadedFile: File | null = null;
  showPaymentSection: boolean = false;
  payment: Payment = {};
  bankAccounts: BankAccount[] = [];
  canReadBankAccounts: boolean = false;
  showBankAccountField: boolean = false;
  isBankAccountRequired: boolean = false;
  minimumAmountHint: string | null = null;
  bankAccountNoticeKey: string | null = null;
  bankAccountNoticeSeverity: 'info' | 'warn' = 'info';
  paymentMethodOptions = [
    { label: 'Cash', value: 'Cash' },
    { label: 'Card', value: 'Card' },
    { label: 'Check', value: 'Check' },
    { label: 'Transfer', value: 'Transfer' },
    { label: 'BOE', value: 'BOE' }
  ];
  filteredPaymentMethodOptions = this.paymentMethodOptions;

  // UX helper flags
  hasSingleShop: boolean = false;
  hasSingleSupplier: boolean = false;
  selectedPurchaseWarehouse: Warehouse | null = null;

  private processFlagsSub?: Subscription;
  private configSavedSub?: Subscription;
  private activityProfileSub?: Subscription;

  constructor(private messageService: MessageService,
    private purchaseService: PurchaseService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private shopService: ShopService,
    private supplierService: SupplierService,
    private cdr: ChangeDetectorRef,
    private configService: AppConfigurationService,
    private productService: ProductService,
    private router: Router,
    private route: ActivatedRoute,
    private bankAccountService: BankAccountService,
    private paymentValidationService: PaymentValidationService,
    private paymentService: PaymentService,
    private categoryService: CategoryService,
    private warehouseService: WarehouseService,
    private organizationService: OrganizationService,
    private datePipe: DatePipe,
    private processModeService: ProcessModeService,
    public activityProfileService: ActivityProfileService) {
    this.loadTaxRate();
  }

  async ngOnInit() {
    this.isLoading = true;
    initTablePageSizeState(TablePageSizeKeys.purchases, this.rowsPerPageOptions, {
      pageSize: this.pageSize,
      lastLazyLoadEvent: this.lastLazyLoadEvent,
    });
    await this.processModeService.ensureLoaded();
    await this.activityProfileService.ensureLoaded();
    this.activityProfileSub = this.activityProfileService.contextChanged$.subscribe(() => this.cdr.markForCheck());
    this.purchaseDocumentChainMode = this.processModeService.isPurchaseDocumentChain();
    this.lowStockThreshold = await getLowStockThreshold(this.configService);
    this.maxPurchaseDate = new Date(); // Today's date
    this.maxPurchaseDate.setHours(23, 59, 59, 999); // Include entire current day
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.initializeTranslations();
    this.initializeStatuses();

    this.applyPurchaseStatusFromQueryParam(this.route.snapshot.queryParamMap.get('purchaseStatus'));
    this.applyCreatePurchaseFromQuery(this.route.snapshot.queryParamMap);
    this.route.queryParamMap.pipe(skip(1)).subscribe((qm) => {
      this.applyPurchaseStatusFromQueryParam(qm.get('purchaseStatus'));
      this.applyFilters();
    });

    this.processFlagsSub = this.processModeService.processFlagsChanged$.subscribe(() => {
      this.applyPurchaseProcessFlagsAfterSettingsSave();
    });

    this.configSavedSub = this.configService.configurationSaved$.subscribe((key) => {
      if (!key) {
        return;
      }
      if (key === 'tax') {
        void this.loadTaxRate();
        return;
      }
      if (key === 'lowStockThreshold') {
        void getLowStockThreshold(this.configService).then((t) => {
          this.lowStockThreshold = t;
          this.cdr.markForCheck();
        });
      }
    });

    await this.setUserRoles();

    // Load data
    await Promise.all([
      this.onGetAllShops(),
      this.onGetAllSuppliers(),
      this.checkPermissions(),
      this.loadBankAccounts(),
      this.onGetAllCategories(),
      this.onGetAllWarehouses(),
    ]);
    this.cols = [
      { field: 'id', header: this.translateService.instant('ID') },
      { field: 'supplier', header: this.translateService.instant('supplier') },
      { field: 'purpose', header: this.translateService.instant('purchase_purpose') },
      { field: 'dateOfPurchase', header: this.translateService.instant('purchase_date') },
      { field: 'totalAmount', header: this.translateService.instant('purchase_total_amount') },
      { field: 'shop', header: this.translateService.instant('shop') },
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
    
    // Load first page of purchases (respects URL purchaseStatus)
    this.applyFilters();
    this.isLoading = false;

    // Open the edit dialog directly when navigated here with ?edit=<purchaseId>
    // (e.g. the "Edit purchase" action on the purchase details page).
    await this.openEditFromQueryParam();
  }

  /**
   * When the route carries an `edit` query param, fetch that purchase and open
   * the edit dialog, then strip the param so a refresh/back doesn't re-open it.
   */
  private async openEditFromQueryParam(): Promise<void> {
    const editId = this.route.snapshot.queryParamMap.get('edit');
    if (!editId) {
      return;
    }
    if (this.canEditPurchase) {
      try {
        this.purchaseService.loadToken();
        const response = await firstValueFrom(this.purchaseService.getPurchase(+editId));
        const purchase = (Array.isArray(response) ? response[0] : response) as Purchase;
        if (purchase?.purchaseId) {
          this.editPurchase(purchase);
        }
      } catch (_error) {
        // Ignore — fall back to the plain table view.
      }
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { edit: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  ngOnDestroy(): void {
    this.processFlagsSub?.unsubscribe();
    this.configSavedSub?.unsubscribe();
    this.activityProfileSub?.unsubscribe();
  }

  /** True when org profile requires lot + expiry on each physical line (matches backend Pharmacy rules). */
  isProductLineBatchExpiryInvalid(product: any): boolean {
    if (!this.activityProfileService.emphasizeBatchAndExpiry) {
      return false;
    }
    if (product?.productType === 'SERVICE') {
      return false;
    }
    const lot = (product?.purchaseItemBatchNumber ?? '').toString().trim();
    const exp = product?.purchaseItemExpirationDate;
    if (!lot) {
      return true;
    }
    if (!exp) {
      return true;
    }
    const d = exp instanceof Date ? exp : new Date(exp);
    return isNaN(d.getTime());
  }

  private readProductAttributeText(product: any, names: string[]): string {
    const attrs = product?.attributes;
    if (!Array.isArray(attrs) || attrs.length === 0) {
      return '';
    }
    const wanted = new Set(names.map((n) => n.trim().toLowerCase()));
    const found = attrs.find((a: any) => wanted.has(String(a?.attributeName ?? '').trim().toLowerCase()));
    if (!found) {
      return '';
    }
    const raw = found.value ?? found.stringValue ?? found.intValue ?? found.doubleValue ?? '';
    return String(raw).trim();
  }

  getProductVariantSummary(product: any): string {
    return buildProductVariantSummary(product);
  }

  isFashionVariantMissing(product: any): boolean {
    return isFashionVariantMissingUtil(product, this.activityProfileService.isFashionProfile);
  }

  openProfileSettings(): void {
    void this.router.navigate(['/administration/settings'], { queryParams: { businessProfile: 1 } });
  }

  /** After settings save: sync document-chain UI, status filter options, and list. */
  private applyPurchaseProcessFlagsAfterSettingsSave(): void {
    this.purchaseDocumentChainMode = this.processModeService.isPurchaseDocumentChain();
    if (!this.purchaseDocumentChainMode && this.selectedPurchaseStatus === 'APPROVED') {
      this.selectedPurchaseStatus = null;
    }
    this.initializeStatuses();
    if (this.purchaseDialog) {
      this.refreshPurchaseDialogDocumentChainSteps();
    }
    this.applyFilters();
    this.cdr.markForCheck();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('purchase' in changes) {
      this.initializePickList();
    }
  }



  private initializeTranslations() {
    this.translateService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang); // Update language
    });

    this.translate
      .getTranslation(this.translateService.getPreferredLanguage())
      .subscribe((translations) => {
        this.TaxEnabledOptions = [
          { label: translations['enabled'], value: true },
          { label: translations['disabled'], value: false },
        ];
        this.discountTypeOptions = [
          { label: translations['amount'], value: 'Amount' },
          { label: translations['percentage'], value: 'Percentage' },
        ];
      });
  }

  calculateTotalAmount(): number {
    let total = 0;

    // Calculate the total based on product quantities and prices
    for (const product of this.targetProducts) {
      total += product.purchaseItemQuantity * product.purchaseItemPricePerUnit;
    }

    // Apply discount first (flat amount or percentage of the line subtotal)
    total -= this.calculateDiscountAmount();

    // Ensure the total is not below zero after applying the discount
    if (total < 0) {
      total = 0;
    }

    // Apply tax if enabled (keep total calculation as is)
    if (this.taxEnabled) {
      total += this.calculateTax(); // Include tax in the total
    }

    // Add non-taxable extras (shipping fee + additional charges) on top of the total
    total += (this.purchase.transportAmount || 0) + (this.purchase.additionalChargesAmount || 0);

    // Return the final total
    return total;
  }

  calculateTax(): number {
    // Calculate tax based on the total amount (not including tax itself)
    const totalWithoutTax = this.calculateTotalAmountWithoutTax();
    return this.taxEnabled ? totalWithoutTax * this.taxRate : 0;
  }

  calculateTotalAmountWithoutTax(): number {
    let total = 0;

    // Calculate the total based on product quantities and prices
    for (const product of this.targetProducts) {
      total += product.purchaseItemQuantity * product.purchaseItemPricePerUnit;
    }

    // Apply discount first (flat amount or percentage of the line subtotal)
    total -= this.calculateDiscountAmount();

    // Ensure the total is not below zero after applying the discount
    if (total < 0) {
      total = 0;
    }

    return total;
  }

  /** Line subtotal (before discount/tax/extras) used as the percentage-discount base. */
  getPurchaseSubtotal(): number {
    return this.targetProducts.reduce(
      (sum, product) => sum + (product.purchaseItemQuantity || 0) * (product.purchaseItemPricePerUnit || 0),
      0
    );
  }

  /** Resolves the discount into a concrete amount, honouring the selected discount type. */
  calculateDiscountAmount(): number {
    const subtotal = this.getPurchaseSubtotal();
    const discount = this.purchase.discount || 0;
    const amount = this.discountType === 'Percentage'
      ? subtotal * (Math.min(Math.max(discount, 0), 100) / 100)
      : discount;
    return Math.min(Math.max(amount, 0), subtotal);
  }

  async loadTaxRate() {
    (await this.configService.getConfiguration("tax")).subscribe((response: any) => {
      this.taxRate = response.value;
      console.log("tax:" + this.taxRate)
    });
  }

  ngAfterViewInit() {
    if (this.pickList) {
      // Get all list items in the source and target containers
      const sourceItems = this.pickList.nativeElement.querySelectorAll('.p-picklist-source .p-picklist-item');
      const targetItems = this.pickList.nativeElement.querySelectorAll('.p-picklist-target .p-picklist-item');

      // Disable double-click for source and target items
      this.disableDoubleClick(sourceItems);
      this.disableDoubleClick(targetItems);
    }
  }

  disableDoubleClick(items: NodeListOf<Element>) {
    items.forEach(item => {
      item.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
  }

  initializePickList(): void {
    this.sourceProducts = this.getSourceProducts();
    this.targetProducts = this.getTargetProducts();
  }

  getSourceProducts(): Product[] {
    if (this.purchase && this.purchase.purchaseItems && this.purchase.purchaseItems.length > 0) {
      return this.products.filter(product =>
        !this.purchase.purchaseItems.some(targetProduct => targetProduct.product.productId === product.productId)
      );
    } else {
      return this.products;
    }
  }

  getTargetProducts(): Product[] {
    let targetProducts: Product[] = [];
    if (this.purchase && this.purchase.purchaseItems && this.purchase.purchaseItems.length > 0) {
      this.purchase.purchaseItems.forEach(element => {
        targetProducts.push(element.product);
      });
      return targetProducts;
    } else {
      return [];
    }
  }

  onMoveToTarget(event: any): void {
    console.log(event);
    console.log(this.targetProducts);
    // Move the selected product from the source to the target
    this.targetProducts.forEach((product: any) => {
      console.log(product);

      // Iterate over each item in the event
      event.items.forEach((item: any) => {
        // Check if the productId matches
        if (product.productId === item.productId) {
          // Add the orderItemPricePerUnit field and assign the value of sellingPrice from the item
          product.purchaseItemPricePerUnit = item.buyingPrice;
          product.purchaseItemQuantity = defaultLineQuantity(product);
        }
      });
    });
    // Force change detection
    this.cdr.detectChanges();
  }

  // Helper methods for product type
  isService(product: Product): boolean {
    return product.productType === 'SERVICE';
  }

  isProduct(product: Product): boolean {
    return !product.productType || product.productType === 'PRODUCT';
  }

  onVariantProductPicked(product: Product): void {
    this.moveProductToTarget(product);
  }

  moveProductToTarget(product: any): void {
    const existingProduct = this.targetProducts.find(targetProduct => targetProduct.productId === product.productId);
    if (!existingProduct) {
      const unit =
        product.buyingPrice != null && product.buyingPrice !== '' && !Number.isNaN(Number(product.buyingPrice))
          ? Number(product.buyingPrice)
          : undefined;
      const newProduct = { ...product, purchaseItemPricePerUnit: unit, purchaseItemQuantity: defaultLineQuantity(product) };
      this.targetProducts.push(newProduct);
      this.sourceProducts = this.sourceProducts.filter(p => p.productId !== product.productId);
      this.purchasePickerFilteredProducts = this.purchasePickerFilteredProducts.filter(
        p => p.productId !== product.productId
      );
      this.purchaseItems.push(newProduct); // Update orderItems for ngModel binding
      this.cdr.detectChanges(); // Trigger change detection
    } else {
      existingProduct.purchaseItemQuantity += lineQuantityStep(existingProduct);
      this.cdr.detectChanges();
    }
  }

  removeProductFromTarget(product: Product): void {
    this.targetProducts = this.targetProducts.filter(p => p.productId !== product.productId);
    const alreadyInSource = this.sourceProducts.some(p => p.productId === product.productId);
    if (!alreadyInSource) {
      this.sourceProducts = [product, ...this.sourceProducts];
    }
    if (this.selectedPurchasePickerCategory?.categoryId) {
      this.lastPurchasePickerLazyLoad = { ...this.lastPurchasePickerLazyLoad, first: 0 };
      this.loadPurchasePickerProductsGrid();
    }
    this.cdr.detectChanges();
  }

  searchProductByBarcode(barcode: string): Product | undefined {
    return this.purchasePickerFilteredProducts.find((p: Product) => p.reference === barcode)
      ?? this.purchasePickerProductSuggestions.find((p: Product) => p.reference === barcode)
      ?? this.quickPurchaseProducts.find((p: Product) => p.reference === barcode);
  }

  // Check if a key is a valid alphanumeric character
  isAlphanumeric(key: string): boolean {
    const isAlphaNum = /^[a-zA-Z0-9]$/.test(key);
    return isAlphaNum;
  }

  private resetBarcodeBuffer(): void {
    this.barcode = '';
    this.lastBarcodeKeyAt = 0;
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
  }

  private shouldIgnoreBarcodeKeyEvent(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }

    return !!target.closest(
      'input, textarea, select, [contenteditable="true"], .p-inputnumber, .p-autocomplete, .p-dropdown, .p-calendar, .p-multiselect, .p-inputtext'
    );
  }

  processBarcode(force = false): void {
    if (!this.barcode) {
      return;
    }
    const raw = this.barcode.trim();
    this.resetBarcodeBuffer();

    if (!force && raw.length < this.barcodeMinLength) {
      return;
    }

    const local = this.searchProductByBarcode(raw);
    if (local) {
      this.moveProductToTarget(local);
      return;
    }

    const warehouseId = this.isAdmin ? this.getSelectedPurchaseWarehouseId() : undefined;
    if (this.isAdmin && warehouseId == null) {
      return;
    }

    this.productService.searchDistinctProductsForPurchase(raw, warehouseId).subscribe({
      next: (response: any) => {
        const list: Product[] = Array.isArray(response) ? response : [];
        const exact = list.find((p) => (p.reference || '').trim() === raw) ?? list[0];
        if (exact) {
          this.moveProductToTarget(exact);
        }
      },
      error: () => {
        /* scanner path: stay silent */
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.scanning || event.ctrlKey || event.altKey || event.metaKey || this.shouldIgnoreBarcodeKeyEvent(event)) {
      this.resetBarcodeBuffer();
      return;
    }

    const key = event.key;

    if (key === 'Enter') {
      this.processBarcode(true);
      return;
    }

    if (!this.isAlphanumeric(key)) {
      return;
    }

    const now = Date.now();
    if (!this.barcode || (this.lastBarcodeKeyAt && now - this.lastBarcodeKeyAt > this.barcodeIdleMs)) {
      this.barcode = '';
    }

    this.lastBarcodeKeyAt = now;
    this.barcode += key;

    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
    }

    this.scanTimeout = setTimeout(() => {
      this.processBarcode();
    }, this.barcodeIdleMs);
  }

  toggleRow(id: number): void {
    this.expandedRows[id.toString()] = !this.isRowExpanded(id.toString());
    const purchase = this.purchases.find(p => p.purchaseId === id);
  }

  isRowExpanded(id: string): boolean {
    return this.expandedRows[id] === true;
  }

  showPurchaseDetails(purchase: any) {
    this.router.navigate(['/purchases/purchases', purchase.purchaseId]);
  }

  private refreshPurchaseDialogDocumentChainSteps(): void {
    if (!this.purchaseDocumentChainMode || !this.purchase?.purchaseId) {
      this.purchaseDialogDocumentChainSteps = [];
      this.purchaseDialogDocumentChainActiveIndex = 0;
      return;
    }
    const L = (key: string) => this.translate.instant(key);
    this.purchaseDialogDocumentChainSteps = [
      { label: L('doc_chain_purchase_step_request') },
      { label: L('doc_chain_purchase_step_approval') },
      { label: L('doc_chain_purchase_step_receipt') },
      { label: L('doc_chain_purchase_step_closure') },
    ];
    this.purchaseDialogDocumentChainActiveIndex = this.purchaseStatusToDocumentChainStepIndex(
      this.purchase.purchaseStatus
    );
  }

  private purchaseStatusToDocumentChainStepIndex(status?: string): number {
    switch (status) {
      case 'PENDING':
        return 0;
      case 'APPROVED':
        return 1;
      case 'RECEIVED':
        return 2;
      case 'COMPLETED':
        return 3;
      default:
        return 0;
    }
  }

  tooltipPurchaseViewDetails(): string {
    return this.purchaseDocumentChainMode
      ? this.translate.instant('doc_chain_purchase_tooltip_view_record')
      : this.translate.instant('purchase_processing');
  }

  tooltipPurchaseEdit(): string {
    return this.purchaseDocumentChainMode
      ? this.translate.instant('doc_chain_purchase_tooltip_edit_request')
      : this.translate.instant('update_purchase');
  }

  tooltipPurchaseCancel(): string {
    return this.purchaseDocumentChainMode
      ? this.translate.instant('doc_chain_purchase_tooltip_cancel')
      : this.translate.instant('cancel_order');
  }

  getPurchaseStatusSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'PENDING': 'info',
      'APPROVED': 'warning',
      'RECEIVED': 'success',
      'COMPLETED': 'success',
      'CANCELED': 'danger'
    };
    return severityMap[status] || 'info';
  }

  getPurchaseStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'PENDING': 'pi pi-clock',
      'APPROVED': 'pi pi-box',
      'RECEIVED': 'pi pi-check-circle',
      'COMPLETED': 'pi pi-flag-fill',
      'CANCELED': 'pi pi-times-circle',
    };
    return iconMap[status] || 'pi pi-question-circle';
  }


  updatePurchaseStatusInBackend(purchase: Purchase) {
    this.purchaseService.updatePurchaseStatus(purchase.purchaseId, purchase).subscribe({
      next: (updatedPurchase) => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('purchase_status_updated')
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('purchase_status_update_failed')
        });
      }
    });
  }

  async cancelPurchase(purchase: Purchase) {
    purchase.purchaseStatus = "CANCELED";
    try {
      this.updatePurchaseStatusInBackend(purchase);
      await this.onGetAllPurchases();
    } catch (error) {
      console.log(error);
    }
  }

  getPaymentStatusSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'PAID': 'success',
      'UNPAID': 'warning',
      'PARTIALLY_PAID': 'warning',
    };
    return severityMap[status] || 'warning';
  }

  getPaymentStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'PAID': 'pi pi-check-circle',
      'UNPAID': 'pi pi-clock',
      'PARTIALLY_PAID': 'pi pi-percentage'
    };
    return iconMap[status] || 'pi pi-question-circle';
  }

  // Quick action methods
  printPurchaseInvoice(purchase: any) {
    // Implement print functionality
    console.log('Print purchase invoice:', purchase);
  }

  exportPurchaseToPDF(purchase: any) {
    // Implement PDF export functionality
    console.log('Export purchase to PDF:', purchase);
  }

  duplicatePurchase(purchase: any) {
    // Implement duplicate purchase functionality
    console.log('Duplicate purchase:', purchase);
  }

  updateStockFromPurchase(purchase: any) {
    // Implement stock update functionality
    console.log('Update stock from purchase:', purchase);
  }



  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
    this.canReadBankAccounts = this.isAdmin;
    this.filteredPaymentMethodOptions = this.paymentMethodOptions;
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddPurchase = this.permissionService.canCreate(this.Ressource);
    this.canEditPurchase = this.permissionService.canUpdate(this.Ressource);
    this.canDeletePurchase = this.permissionService.canDelete(this.Ressource);
    this.canReadPurchase = this.permissionService.canRead(this.Ressource);
    this.canProcessPurchase = this.permissionService.canProcess(this.Ressource);
    this.canCancelPurchase = this.permissionService.canCancel(this.Ressource);
    this.canImportPurchase = this.permissionService.canCreate(this.Ressource); // Use create permission for import
    this.canAddProduct = this.permissionService.canCreate('PRODUCTS');
    this.canEditProduct = this.permissionService.canUpdate('PRODUCTS');
    this.canDeleteProduct = this.permissionService.canDelete('PRODUCTS');
    this.canArchiveProduct = this.permissionService.canArchive('PRODUCTS');
    this.canReadProduct = this.permissionService.canRead('PRODUCTS');
    // Permissions for adding categories, suppliers, and warehouses
    this.canAddCategory = this.permissionService.canCreate('CATEGORIES');
    this.canAddSupplier = this.permissionService.canCreate('SUPPLIERS');
    this.canAddWarehouse = this.permissionService.canCreate('WAREHOUSES');
    this.canAddShop = this.permissionService.canCreate('SHOPS');
  }

  deleteSelectedPurchases() {
    if (!this.canDeletePurchase) return;
    this.deletePurchasesDialog = true;
  }

  editPurchase(purchase: Purchase) {
    if (!this.canEditPurchase) return;
    this.purchase = { ...purchase };
    this.discountType = purchase.discountType === 'Percentage' ? 'Percentage' : 'Amount';
    this.taxEnabled = !!purchase.taxEnabled;
    this.purchaseItems = this.purchase.purchaseItems.map(item => {
      // Convert expiration date string to Date object for calendar component
      let expirationDate: Date | null = null;
      if (item.expirationDate) {
        const date = new Date(item.expirationDate);
        if (!isNaN(date.getTime())) {
          expirationDate = date;
        }
      }

      const displayQty = item.displayQuantity ?? QuantityScale.toDisplayQuantity(item.product, item.quantityPurchased ?? 0);

      return {
        purchaseItemId: item.purchaseItemId,
        product: {
          ...item.product,
          purchaseItemQuantity: displayQty,
          purchaseItemPricePerUnit: item.buyingPrice,
          purchaseItemExpirationDate: expirationDate,
          purchaseItemBatchNumber: item.batchNumber || null,
        },
        quantityPurchased: item.quantityPurchased,
        displayQuantity: displayQty,
        pricePerUnit: item.buyingPrice,
      };
    });
    if (this.isAdmin) {
      const firstProductWarehouse = this.purchase.purchaseItems?.[0]?.product?.warehouse || null;
      this.selectedPurchaseWarehouse = firstProductWarehouse;
    }
    this.resetPurchasePickerUi();
    void this.loadPurchasePickerCategories();
    void this.onLoadQuickPurchaseProducts();
    this.initializePickList();
    this.purchaseDialog = true;
    this.refreshPurchaseDialogDocumentChainSteps();

    // Add the new fields directly to the purchase items
    this.purchase.purchaseItems.forEach(item => {
      const displayQty = item.displayQuantity ?? QuantityScale.toDisplayQuantity(item.product, item.quantityPurchased ?? 0);
      item.product.purchaseItemQuantity = displayQty;
      item.product.purchaseItemPricePerUnit = item.buyingPrice;
      item.product['purchaseItemExpirationDate'] = item.expirationDate || null;
      item.product['purchaseItemBatchNumber'] = item.batchNumber || null;
    });

    console.log(this.purchase);
  }

  deletePurchase(purchase: Purchase) {
    if (!this.canDeletePurchase) return;
    this.deletePurchaseDialog = true;
    this.purchase = { ...purchase };
  }

  confirmDeleteSelected() {
    this.deletePurchasesDialog = false;
    this.selectedPurchases.forEach(selectedPurchase => this.onDeletePurchase(selectedPurchase.purchaseId));
    this.selectedPurchases = [];
  }

  async confirmDelete() {
    this.deletePurchaseDialog = false;
    await this.onDeletePurchase(this.purchase.purchaseId);
    this.purchase = {};
  }

  hideDialog() {
    this.purchaseDialog = false;
    this.submitted = false;
    this.resetPurchaseForm();
  }

  resetPurchaseForm() {
    this.purchase = {};
    this.discountType = 'Amount';
    this.taxEnabled = false;
    this.targetProducts = [];
    this.sourceProducts = [];
    this.selectedPurchaseWarehouse = null;
    this.resetPurchasePickerUi();
    this.showPaymentSection = false;
    this.payment = {};
    this.submitted = false;
  }

  openImportDialog(): void {
    this.importDialogVisible = true;
    // Set admin status for import component
    setTimeout(() => {
      if (this.purchaseImport) {
        this.purchaseImport.setAdminStatus(this.isAdmin);
      }
    }, 0);
  }

  onImportSuccess(): void {
    this.onGetAllPurchases();
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('successful'),
      detail: this.translate.instant('import_completed_successfully'),
      life: 3000
    });
  }

  /** When NadiPilot sends the user here with ?newPurchase=1, open the prepared new-purchase dialog. */
  private applyCreatePurchaseFromQuery(qp: ParamMap): void {
    if (!qp || !qp.get('newPurchase')) {
      return;
    }
    const supplierName = qp.get('supplier');
    // Defer so permissions/data finish loading before opening the dialog.
    setTimeout(() => {
      try {
        this.openNew();
        if (supplierName) {
          this.prefillPurchaseSupplier(supplierName);
        }
      } catch {
        // best-effort; the user is already on the purchases screen
      }
    }, 600);
  }

  /** Best-effort: match a supplier by name from NadiPilot and preselect it once the list has loaded. */
  private prefillPurchaseSupplier(name: string, attempt: number = 0): void {
    const wanted = (name || '').trim().toLowerCase();
    if (!wanted) {
      return;
    }
    const list = this.suppliers || [];
    if (!list.length) {
      if (attempt < 15) {
        setTimeout(() => this.prefillPurchaseSupplier(name, attempt + 1), 200);
      }
      return;
    }
    const match = list.find((s: any) => (s.name || '').toLowerCase().includes(wanted));
    if (match) {
      this.purchase.supplier = match;
    }
  }

  openNew() {
    if (!this.canAddPurchase) return;
    this.resetPurchaseForm();
    this.onGetAllShops();
    this.onGetAllSuppliers();
    this.purchase.dateOfPurchase = new Date();
    this.purchase.discount = 0;
    this.purchase.taxEnabled = false;
    this.purchaseItems = [];
    this.selectedPurchaseWarehouse = null;
    this.resetPurchasePickerUi();
    void this.loadPurchasePickerCategories();
    void this.onLoadQuickPurchaseProducts();
    this.initializePickList();
    this.purchaseDialog = true;
  }

  // isPurchaseFinalized(purchase: any): boolean {
  //   const today = new Date();
  //   const dateOfPurchase = new Date(purchase.dateOfPurchase);
  //   return dateOfPurchase.toDateString() === today.toDateString();
  // }

  async savePurchase() {
    this.submitted = true;
    console.log(this.purchase)

    // Validate payment if payment section is shown
    if (this.showPaymentSection) {
      const paymentValid = await this.validatePayment();
      if (!paymentValid) {
        return; // Stop if payment validation fails
      }
    }

    if (this.purchase.purpose) {
      if (this.purchase.dateOfPurchase) {
        // Ensure `dateOfExpense` is a Date object
        const date =
          typeof this.purchase.dateOfPurchase === "string"
            ? new Date(this.purchase.dateOfPurchase)
            : this.purchase.dateOfPurchase;

        // Format the date into YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
        const day = String(date.getDate()).padStart(2, "0");

        this.purchase.dateOfPurchase = `${year}-${month}-${day}`; // Convert to string format
      }

      // Check if the customer is selected
      if (!this.purchase.supplier) {
        // Optionally, show an error message or handle it as needed
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('supplier_required'),
          life: 3000
        });
        return; // Exit the method to prevent submission
      }

      if (this.isAdmin && !this.purchase.shop) {
        // Optionally, show an error message or handle it as needed
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('shop_required'),
          life: 3000
        });
        return; // Exit the method to prevent submission
      }
      if (this.isAdmin && !this.selectedPurchaseWarehouse) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('warehouse_required'),
          life: 3000
        });
        return;
      }
      const badUnitPrice = this.targetProducts.some(
        p => p.purchaseItemPricePerUnit == null || Number(p.purchaseItemPricePerUnit) <= 0
      );
      if (badUnitPrice) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('purchase_line_unit_price_required'),
          life: 4000
        });
        return;
      }

      // Check if at least one product is selected
      if (this.targetProducts.length === 0) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('at_least_one_product_required'),
          life: 3000
        });
        return; // Exit the method to prevent submission
      }

      if (this.targetProducts.some((p) => this.isFashionVariantMissing(p))) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('profile_mode_fashion_purchase_variant_required'),
          life: 4500
        });
        return;
      }

      if (this.targetProducts.some((p) => this.isProductLineBatchExpiryInvalid(p))) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('purchase_batch_lot_expiry_required'),
          life: 5000
        });
        return;
      }

      // Map the target products to purchase items with the required structure
      const purchaseItems: PurchaseItem[] = this.targetProducts.map(product => {
        let expirationDate: string | null = null;
        
        // Convert Date object to ISO string format (YYYY-MM-DD) if expiration date is provided
        if (product['purchaseItemExpirationDate']) {
          const expDate = product['purchaseItemExpirationDate'] instanceof Date 
            ? product['purchaseItemExpirationDate']
            : new Date(product['purchaseItemExpirationDate']);
          
          if (!isNaN(expDate.getTime())) {
            const year = expDate.getFullYear();
            const month = String(expDate.getMonth() + 1).padStart(2, '0');
            const day = String(expDate.getDate()).padStart(2, '0');
            expirationDate = `${year}-${month}-${day}`;
          }
        }

        return buildPurchaseItemPayload(
          product,
          product['purchaseItemQuantity'],
          product['purchaseItemPricePerUnit'],
          {
            expirationDate,
            batchNumber: product['purchaseItemBatchNumber'] ? String(product['purchaseItemBatchNumber']).trim() : null,
          }
        );
      });

      // Create a new order object to avoid modifying the existing one directly
      const newPurchase: Purchase = { ...this.purchase };

      // Assign the new order items to the new order
      newPurchase.purchaseItems = purchaseItems;

      // Remove temporary properties from each product in purchaseItems
      newPurchase.purchaseItems.forEach(purchaseItem => {
        delete purchaseItem.product['purchaseItemQuantity'];
        delete purchaseItem.product['purchaseItemPricePerUnit'];
        delete purchaseItem.product['purchaseItemExpirationDate'];
        delete purchaseItem.product['purchaseItemBatchNumber'];
      });

      newPurchase.taxEnabled = this.taxEnabled;
      newPurchase.discountType = this.discountType;

      if (this.isAdmin) {
        const whId = this.getSelectedPurchaseWarehouseId();
        if (whId != null) {
          newPurchase.receivingWarehouseId = whId;
        }
      }

      console.log(newPurchase);

      this.isSaving = true;
      try {
        let savedPurchase: Purchase;

        if (newPurchase.purchaseId) {
          savedPurchase = await this.updatePurchase(newPurchase.purchaseId, newPurchase);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('purchase_updated'),
            life: 3000
          });
        } else {
          savedPurchase = await this.addPurchase(newPurchase);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('purchase_added'),
            life: 3000
          });

          // Only process payment if we have a valid saved purchase and payment section is shown
          if (this.showPaymentSection && savedPurchase) {
            console.log('Processing payment for purchase:', savedPurchase);
            await this.processPaymentForPurchase(savedPurchase);
          }
        }
      } catch (error) {
        console.error(error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_occurred'),
          life: 3000
        });
        return;
      } finally {
        this.isSaving = false;
      }

      this.purchases = [...this.purchases];
      this.purchaseDialog = false;
      this.resetPurchaseForm();
    }
  }

  @ViewChild('dt') dt!: Table;

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.globalFilter = value;

    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      globalFilter: this.globalFilter
    };

    this.onLazyLoad(lazyEvent);
  }

  private initializeStatuses() {
    this.statuses = this.purchaseDocumentChainMode
      ? [
          { label: 'Pending', value: 'PENDING' },
          { label: 'Approved', value: 'APPROVED' },
          { label: 'Received', value: 'RECEIVED' },
          { label: 'Completed', value: 'COMPLETED' },
          { label: 'Canceled', value: 'CANCELED' },
        ]
      : [
          { label: 'Pending', value: 'PENDING' },
          { label: 'Received', value: 'RECEIVED' },
          { label: 'Completed', value: 'COMPLETED' },
          { label: 'Canceled', value: 'CANCELED' },
        ];

    // Payment statuses
    this.paymentStatuses = [
      { label: 'Paid', value: 'PAID' },
      { label: 'Partially_Paid', value: 'PARTIALLY_PAID' },
      { label: 'Unpaid', value: 'UNPAID' },
      { label: 'Pending', value: 'PENDING' },
      { label: 'Failed', value: 'FAILED' },
      { label: 'Refunded', value: 'REFUNDED' },
    ];
  }

  applyFilters() {
    // Build filters object in the format expected by the service
    // Service expects: { field: { value: ..., matchMode: ... } }
    const filters: any = {};
    
    if (this.selectedPurchaseStatus) {
      filters.purchaseStatus = { value: this.selectedPurchaseStatus, matchMode: 'equals' };
    }
    if (this.selectedPaymentStatus) {
      filters.paymentStatus = { value: this.selectedPaymentStatus, matchMode: 'equals' };
    }
    if (this.selectedSupplier) {
      // Pass the full supplier object - the service will extract supplierId from it
      filters.supplierId = { value: this.selectedSupplier, matchMode: 'equals' };
    }
    if (this.selectedShop) {
      // Pass the full shop object - the service will extract shopName from it
      filters.shopName = { value: this.selectedShop, matchMode: 'equals' };
    }
    if (this.startDate) {
      filters.fromDate = { value: this.startDate, matchMode: 'equals' };
    }
    if (this.endDate) {
      filters.toDate = { value: this.endDate, matchMode: 'equals' };
    }

    console.log('=== APPLYING FILTERS ===');
    console.log('Selected purchase status:', this.selectedPurchaseStatus);
    console.log('Selected payment status:', this.selectedPaymentStatus);
    console.log('Selected supplier:', this.selectedSupplier);
    console.log('Selected shop:', this.selectedShop);
    console.log('Shop ID:', this.selectedShop?.shopId || (this.selectedShop as any)?.id);
    console.log('Start date:', this.startDate);
    console.log('End date:', this.endDate);
    console.log('Filters object:', JSON.stringify(filters, null, 2));

    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      filters: filters
    };

    this.updateLastLazyLoadEvent(lazyEvent);
    this.loadPurchases();
  }

  onFilterChange() {
    // Apply filters immediately when filter values change
    this.applyFilters();
  }

  clearFilters() {
    this.selectedPurchaseStatus = null;
    this.selectedPaymentStatus = null;
    this.selectedSupplier = null;
    this.selectedShop = null;
    this.startDate = null;
    this.endDate = null;
    this.globalFilter = '';

    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      globalFilter: '',
      filters: {}
    };

    this.onLazyLoad(lazyEvent);
  }

  private applyPurchaseStatusFromQueryParam(raw: string | null): void {
    const allowed = PurchasesComponent.URL_PURCHASE_STATUSES as readonly string[];
    this.selectedPurchaseStatus = raw && allowed.includes(raw) ? raw : null;
  }


  clear(table: Table) {
    table.clear();
  }

  async onGetAllShops() {
    try {
      const response = await firstValueFrom(this.shopService.getShops()) as Shop[];
      this.shops = response;
      console.log(this.shops);

      // UX: if there is only one shop, preselect it for the purchase form
      this.hasSingleShop = Array.isArray(this.shops) && this.shops.length === 1;
      if (this.hasSingleShop && !this.purchase.shop) {
        this.purchase.shop = this.shops[0];
      }
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_shops'),
        life: 3000,
      });
      console.log(err);
    }
  }

  async onGetAllSuppliers() {
    try {
      const response = await firstValueFrom(this.supplierService.getSuppliers()) as Supplier[];
      this.suppliers = response;
      console.log(this.suppliers);

      // UX: if there is only one supplier, preselect it for the purchase form
      this.hasSingleSupplier = Array.isArray(this.suppliers) && this.suppliers.length === 1;
      if (this.hasSingleSupplier && !this.purchase.supplier) {
        this.purchase.supplier = this.suppliers[0];
      }
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_suppliers'),
        life: 3000,
      });
      console.log(err);
    }
  }

  onLazyLoad(event: LazyLoadEvent) {
    const extendedEvent: LazyLoadEventExt = {
      ...event,
      globalFilter: this.globalFilter
    };

    this.updateLastLazyLoadEvent(extendedEvent);
    this.loadPurchases();
  }

  private updateLastLazyLoadEvent(event: LazyLoadEvent) {
    persistTablePageSizeFromLazyEvent(TablePageSizeKeys.purchases, this.rowsPerPageOptions, event, {
      pageSize: this.pageSize,
    });
    const rows = event.rows ?? this.lastLazyLoadEvent.rows ?? this.pageSize;
    this.lastLazyLoadEvent = {
      first: event.first ?? this.lastLazyLoadEvent.first,
      rows,
      sortField: event.sortField ?? this.lastLazyLoadEvent.sortField,
      sortOrder: event.sortOrder ?? this.lastLazyLoadEvent.sortOrder,
      globalFilter: event.globalFilter ?? this.globalFilter,
      filters: event.filters ?? this.lastLazyLoadEvent.filters
    };
  }

  loadPurchases() {
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;

    const page = first! / rows!;
    const size = rows!;
    const direction = sortOrder === -1 ? 'ASC' : 'DESC';
    
    // Pass filters as-is - the service expects { field: { value: ..., matchMode: ... } } format
    const filterPayload = filters || {};

    console.log('Loading purchases with parameters:', {
      page,
      size,
      sortField,
      direction,
      globalFilter,
      filters: filterPayload
    });

    this.purchaseService.getPurchasesPaginated(
      page,
      size,
      globalFilter || '',
      sortField!,
      direction,
      filterPayload
    ).subscribe({
      next: (res: any) => {
        console.log('Paginated purchases response:', res);
        // Assign the paginated purchases
        this.purchases = res.page.content.map((p: any) => {
          if (p.shop?.cashRegister?.dailyBalances) {
            delete p.shop.cashRegister.dailyBalances;
          }
          return {
            ...p,
            creationDate: p.creationDate ? new Date(p.creationDate) : null,
            dateOfPurchase: p.dateOfPurchase ? new Date(p.dateOfPurchase) : null,
            boeExpirationDate: p.boeExpirationDate ? new Date(p.boeExpirationDate) : null,
            checkExpirationDate: p.checkExpirationDate ? new Date(p.checkExpirationDate) : null
          };
        });

        // Assign total records and summary KPIs from backend
        this.totalRecords = res.totalPurchases;
        this.purchasesTotalAmount = res.totalAmount ?? 0;
        this.purchasesTotalPaid = res.totalPaid ?? 0;
        this.purchasesRemainingBalance = res.remainingBalance ?? 0;

        this.isLoading = false;
        
        // Trigger change detection to ensure table updates
        if (this.cdr) {
          this.cdr.detectChanges();
        }
      },
      error: (err: any) => {
        console.error(err);
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_purchases'),
          life: 3000
        });
      }
    });
  }

  // Keep this method for backward compatibility but make it call loadPurchases
  async onGetAllPurchases() {
    this.loadPurchases();
  }

  async onDeletePurchase(id: any) {
    await this.purchaseService.deletePurchase(id)
      .subscribe({
        next: (response: any) => {
          this.onGetAllPurchases();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('purchase_deleted'),
            life: 3000
          });
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_deleting_purchase'),
            life: 3000
          });
          console.error(err);
        },
      });
  }

  async updatePurchase(id: any, purchase: any): Promise<Purchase> {
    console.log(purchase)
    purchase.products = this.targetProducts;
    return new Promise((resolve, reject) => {
      this.purchaseService.updatePurchase(id, purchase)
        .subscribe({
          next: (response: any) => {
            console.log(response);
            this.onGetAllPurchases();
            this.refreshPurchasePickerCatalog();
            // Return the updated purchase
            resolve(response as Purchase);
          },
          error: (err: any) => {
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: this.translate.instant('error_while_updating_purchase'),
              life: 3000
            });
            reject(err);
          },
        });
    });
  }

  async addPurchase(purchase: any): Promise<Purchase> {
    console.log(purchase);
    return new Promise((resolve, reject) => {
      this.purchaseService.savePurchase(purchase).subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllPurchases();
          this.refreshPurchasePickerCatalog();
          // Return the saved purchase
          resolve(response as Purchase);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_purchase'),
            life: 3000
          });
          console.log(err);
          reject(err);
        },
      });
    });
  }



  // async onGetAllProducts() {
  //   await this.productService.getProducts()
  //     .subscribe({
  //       next: (response: any) => {
  //         this.products = response;
  //         this.products.forEach((product: any) => (product.creationDate = new Date(<Date>product.creationDate)));
  //         console.log(this.products);
  //       },
  //       error: (err: any) => {
  //         this.messageService.add({
  //           severity: 'error',
  //           summary: this.translate.instant('error'),
  //           detail: this.translate.instant('error_while_getting_products'),
  //           life: 3000
  //         });
  //         console.log(err)
  //       },
  //       complete: () => {
  //         // Set loading to false after data is fully loaded
  //         this.isLoading = false;
  //       }
  //     })
  // }





  async exportPdf() {
    if (this.isExporting) {
      return; // Prevent multiple simultaneous exports
    }

    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      
      // Show initial loading message
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('exporting'),
        detail: this.translate.instant('exporting_pdf_please_wait') || 'Exporting PDF, please wait...',
        life: 3000
      });

      // Load token and get organization's default locale
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      // Fetch all filtered purchases from backend using pagination
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredPurchases: any[] = [];
      const pageSize = 1000;
      let currentPage = 0;
      let hasMorePages = true;
      const maxPages = 100; // Safety limit
      
      // Build filters object from component filter properties (same as loadPurchases)
      const { sortField, sortOrder } = this.lastLazyLoadEvent;
      const direction = sortOrder === -1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...this.lastLazyLoadEvent.filters };
      
      if (this.selectedPurchaseStatus) {
        filterPayload['purchaseStatus'] = { value: this.selectedPurchaseStatus, matchMode: 'equals' };
      }
      
      if (this.selectedPaymentStatus) {
        filterPayload['paymentStatus'] = { value: this.selectedPaymentStatus, matchMode: 'equals' };
      }
      
      if (this.selectedSupplier) {
        filterPayload['supplierId'] = { value: this.selectedSupplier.supplierId, matchMode: 'equals' };
      }
      
      if (this.selectedShop) {
        filterPayload['shopId'] = { value: this.selectedShop.shopId, matchMode: 'equals' };
      }
      
      if (this.startDate) {
        filterPayload['dateOfPurchaseFrom'] = { value: this.startDate, matchMode: 'equals' };
      }
      
      if (this.endDate) {
        filterPayload['dateOfPurchaseTo'] = { value: this.endDate, matchMode: 'equals' };
      }
      
      // Ensure token is loaded
      this.purchaseService.loadToken();
      
      // Fetch all pages
      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;
        
        const response = await firstValueFrom(
          this.purchaseService.getPurchasesPaginated(
            currentPage,
            pageSize,
            this.globalFilter || '',
            sortField || 'dateOfPurchase',
            direction,
            filterPayload
          )
        );
        
        const pageContent = response.page?.content || response.content || response || [];
        allFilteredPurchases = allFilteredPurchases.concat(pageContent);
        
        // Check if there are more pages
        const totalElements = response.totalPurchases || response.totalElements || response.total || 0;
        hasMorePages = allFilteredPurchases.length < totalElements && pageContent.length === pageSize;
        currentPage++;
      }
      
      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';
      
      // Build translated export columns based on organization's default locale
      const translationKeyMap: { [key: string]: string } = {
        'reference': 'purchase_reference',
        'dateOfPurchase': 'purchase_date',
        'purpose': 'purchase_purpose',
        'purchaseStatus': 'purchase_status',
        'totalAmount': 'purchase_total_amount',
        'totalPaid': 'purchase_total_paid',
        'paymentStatus': 'purchase_payment_status',
        'supplier': 'purchase_supplier',
        'shop': 'purchase_shop'
      };
      
      const translatedExportColumns: ExportColumn[] = this.exportColumns
        .filter((col) => col.dataKey !== 'id' && col.dataKey !== 'purchaseId') // Exclude ID columns
        .map((col) => {
          const translationKey = translationKeyMap[col.dataKey] || col.dataKey;
          return {
            title: this.translate.instant(translationKey),
            dataKey: col.dataKey
          };
        });
      
      // Get translated title for PDF
      const pdfTitle = this.translate.instant('purchases_menu_title') || this.translate.instant('purchases');
      
      // Prepare purchases for export with formatted fields
      const exportData = allFilteredPurchases.map(purchase => {
        const exportItem: any = { ...purchase };
        
        // Format date of purchase as numeric date (dd/MM/yyyy)
        if (exportItem.dateOfPurchase) {
          const date = exportItem.dateOfPurchase instanceof Date 
            ? exportItem.dateOfPurchase 
            : new Date(exportItem.dateOfPurchase);
          exportItem.dateOfPurchase = this.datePipe.transform(date, 'dd/MM/yyyy') || '';
        }
        
        // Extract supplier name
        if (exportItem.supplier) {
          exportItem.supplier = typeof exportItem.supplier === 'object' 
            ? (exportItem.supplier.name || exportItem.supplier.supplierName || 'N/A')
            : exportItem.supplier;
        } else {
          exportItem.supplier = 'N/A';
        }
        
        // Extract shop name
        if (exportItem.shop) {
          exportItem.shop = typeof exportItem.shop === 'object' 
            ? (exportItem.shop.shopName || exportItem.shop.name || 'N/A')
            : exportItem.shop;
        } else {
          exportItem.shop = 'N/A';
        }
        
        return exportItem;
      });
      
      // Export with translated headers and title
      this.reportingService.exportPdf(translatedExportColumns, exportData, 'purchases', pdfTitle);
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredPurchases.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_exporting') || 'Error exporting PDF',
        life: 5000
      });
    } finally {
      this.isExporting = false;
      this.exportProgress = '';
    }
  }

  async exportExcel() {
    if (this.isExporting) {
      return; // Prevent multiple simultaneous exports
    }

    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      
      // Show initial loading message
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('exporting'),
        detail: this.translate.instant('exporting_excel_please_wait') || 'Exporting Excel, please wait...',
        life: 3000
      });

      // Load token and get organization's default locale
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      // Fetch all filtered purchases from backend using pagination
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredPurchases: any[] = [];
      const pageSize = 1000;
      let currentPage = 0;
      let hasMorePages = true;
      const maxPages = 100; // Safety limit
      
      // Build filters object from component filter properties (same as loadPurchases)
      const { sortField, sortOrder } = this.lastLazyLoadEvent;
      const direction = sortOrder === -1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...this.lastLazyLoadEvent.filters };
      
      if (this.selectedPurchaseStatus) {
        filterPayload['purchaseStatus'] = { value: this.selectedPurchaseStatus, matchMode: 'equals' };
      }
      
      if (this.selectedPaymentStatus) {
        filterPayload['paymentStatus'] = { value: this.selectedPaymentStatus, matchMode: 'equals' };
      }
      
      if (this.selectedSupplier) {
        filterPayload['supplierId'] = { value: this.selectedSupplier.supplierId, matchMode: 'equals' };
      }
      
      if (this.selectedShop) {
        filterPayload['shopId'] = { value: this.selectedShop.shopId, matchMode: 'equals' };
      }
      
      if (this.startDate) {
        filterPayload['dateOfPurchaseFrom'] = { value: this.startDate, matchMode: 'equals' };
      }
      
      if (this.endDate) {
        filterPayload['dateOfPurchaseTo'] = { value: this.endDate, matchMode: 'equals' };
      }
      
      // Ensure token is loaded
      this.purchaseService.loadToken();
      
      // Fetch all pages
      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;
        
        const response = await firstValueFrom(
          this.purchaseService.getPurchasesPaginated(
            currentPage,
            pageSize,
            this.globalFilter || '',
            sortField || 'dateOfPurchase',
            direction,
            filterPayload
          )
        );
        
        const pageContent = response.page?.content || response.content || response || [];
        allFilteredPurchases = allFilteredPurchases.concat(pageContent);
        
        // Check if there are more pages
        const totalElements = response.totalPurchases || response.totalElements || response.total || 0;
        hasMorePages = allFilteredPurchases.length < totalElements && pageContent.length === pageSize;
        currentPage++;
      }
      
      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';
      
      // Map column field names to translation keys
      const translationKeyMap: { [key: string]: string } = {
        'reference': 'purchase_reference',
        'dateOfPurchase': 'purchase_date',
        'purpose': 'purchase_purpose',
        'purchaseStatus': 'purchase_status',
        'totalAmount': 'purchase_total_amount',
        'totalPaid': 'purchase_total_paid',
        'paymentStatus': 'purchase_payment_status',
        'supplier': 'purchase_supplier',
        'shop': 'purchase_shop'
      };
      
      // Prepare purchases for export with formatted fields
      const modifiedPurchases = allFilteredPurchases.map(purchase => {
        const modifiedPurchase: any = { ...purchase };

        // Format date of purchase as numeric date (dd/MM/yyyy)
        if (modifiedPurchase.dateOfPurchase) {
          const date = modifiedPurchase.dateOfPurchase instanceof Date 
            ? modifiedPurchase.dateOfPurchase 
            : new Date(modifiedPurchase.dateOfPurchase);
          modifiedPurchase.dateOfPurchase = this.datePipe.transform(date, 'dd/MM/yyyy') || '';
        }
        
        // Extract supplier name
        if (modifiedPurchase.supplier) {
          modifiedPurchase.supplier = typeof modifiedPurchase.supplier === 'object' 
            ? (modifiedPurchase.supplier.name || modifiedPurchase.supplier.supplierName || 'N/A')
            : modifiedPurchase.supplier;
        } else {
          modifiedPurchase.supplier = 'N/A';
        }
        
        // Extract shop name
        if (modifiedPurchase.shop) {
          modifiedPurchase.shop = typeof modifiedPurchase.shop === 'object' 
            ? (modifiedPurchase.shop.shopName || modifiedPurchase.shop.name || 'N/A')
            : modifiedPurchase.shop;
        } else {
          modifiedPurchase.shop = 'N/A';
        }

        // Remove the column you want to exclude
        delete modifiedPurchase.creationDate;

        return modifiedPurchase;
      });

      // Create a translated version of the data with translated headers
      // For Excel, we need to create objects with translated keys
      const translatedPurchases = modifiedPurchases.map(purchase => {
        const translated: any = {};
        this.cols.forEach(col => {
          // Exclude creationDate and ID columns
          if (col.field !== 'creationDate' && col.field !== 'id' && col.field !== 'purchaseId') {
            const translationKey = translationKeyMap[col.field] || col.field;
            const translatedHeader = this.translate.instant(translationKey);
            translated[translatedHeader] = purchase[col.field as keyof Purchase];
          }
        });
        return translated;
      });

      // Now, export the translated array to Excel
      this.reportingService.exportExcel(translatedPurchases, 'purchases');
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredPurchases.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_exporting') || 'Error exporting Excel',
        life: 5000
      });
    } finally {
      this.isExporting = false;
      this.exportProgress = '';
    }
  }

  /** Refresh quick picks and category grid after catalog changes (same role as former loadProductsForPicker). */
  private refreshPurchasePickerCatalog(): void {
    void this.onLoadQuickPurchaseProducts();
    if (this.selectedPurchasePickerCategory?.categoryId) {
      this.lastPurchasePickerLazyLoad = { ...this.lastPurchasePickerLazyLoad, first: 0 };
      this.loadPurchasePickerProductsGrid();
    }
  }

  private resetPurchasePickerUi(): void {
    this.purchasePickerFilteredProducts = [];
    this.purchasePickerProductSuggestions = [];
    this.purchasePickerSelectedProduct = null;
    this.selectedPurchasePickerCategory = null;
    this.filteredPurchasePickerCategories = [];
    this.quickPurchaseProducts = [];
    this.totalPurchasePickerGridRecords = 0;
    this.purchasePickerGridLoading = false;
    this.purchasePickerProductSuggestionsLoading = false;
    this.lastPurchasePickerLazyLoad = {
      first: 0,
      rows: 24,
      sortField: 'name',
      sortOrder: 1,
      globalFilter: '',
      filters: {}
    };
  }

  async loadPurchasePickerCategories(): Promise<void> {
    try {
      const response = await firstValueFrom(this.categoryService.getProductsCategories()) as Category[];
      this.purchasePickerCategories = Array.isArray(response)
        ? response.map((c: any) => ({
            ...c,
            creationDate: c.creationDate ? new Date(c.creationDate as Date) : null
          }))
        : [];
      this.filteredPurchasePickerCategories = [...this.purchasePickerCategories];
    } catch {
      this.purchasePickerCategories = [];
      this.filteredPurchasePickerCategories = [];
    }
  }

  filterPurchasePickerCategories(event: any): void {
    const query = (event.query || '').toLowerCase();
    if (!query) {
      this.filteredPurchasePickerCategories = [...this.purchasePickerCategories];
    } else {
      this.filteredPurchasePickerCategories = this.purchasePickerCategories.filter((c) =>
        (c.categoryName || '').toLowerCase().includes(query)
      );
    }
  }

  filterByPurchasePickerCategory(): void {
    if (!this.selectedPurchasePickerCategory?.categoryId) {
      this.purchasePickerFilteredProducts = [];
      this.totalPurchasePickerGridRecords = 0;
      this.updatePurchasePickerProductsFilter('categoryId', null);
      return;
    }
    this.purchasePickerFilteredProducts = [];
    this.updatePurchasePickerProductsFilter('categoryId', this.selectedPurchasePickerCategory.categoryId);
    this.lastPurchasePickerLazyLoad = { ...this.lastPurchasePickerLazyLoad, first: 0 };
    this.loadPurchasePickerProductsGrid();
  }

  clearPurchasePickerCategoryFilter(): void {
    this.selectedPurchasePickerCategory = null;
    this.purchasePickerFilteredProducts = [];
    this.totalPurchasePickerGridRecords = 0;
    this.updatePurchasePickerProductsFilter('categoryId', null);
  }

  private updatePurchasePickerProductsFilter(field: string, value: any): void {
    const currentFilters = { ...(this.lastPurchasePickerLazyLoad.filters || {}) };
    if (value === undefined || value === null || value === '') {
      delete currentFilters[field];
    } else {
      currentFilters[field] = { value };
    }
    this.lastPurchasePickerLazyLoad = {
      ...this.lastPurchasePickerLazyLoad,
      first: 0,
      filters: currentFilters
    };
  }

  loadPurchasePickerProductsGrid(): void {
    if (!this.selectedPurchasePickerCategory?.categoryId) {
      this.purchasePickerFilteredProducts = [];
      this.totalPurchasePickerGridRecords = 0;
      return;
    }
    const warehouseId = this.isAdmin ? this.getSelectedPurchaseWarehouseId() : undefined;
    if (this.isAdmin && warehouseId == null) {
      this.purchasePickerFilteredProducts = [];
      this.totalPurchasePickerGridRecords = 0;
      return;
    }

    this.purchasePickerGridLoading = true;
    this.productService.loadToken();

    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastPurchasePickerLazyLoad;
    const productFilters: { [k: string]: any } = filters ? { ...filters } : {};
    if (this.isAdmin && warehouseId != null) {
      productFilters['warehouseId'] = { value: warehouseId };
    }

    const page = (first ?? 0) / (rows ?? 24);
    const size = rows ?? 24;
    const direction = sortOrder === -1 ? 'DESC' : 'ASC';

    this.productService
      .getProductsPaginated(page, size, globalFilter || '', sortField || 'name', direction, productFilters)
      .subscribe({
        next: (res: any) => {
          const selectedWarehouseId = this.getSelectedPurchaseWarehouseId();
          let mapped: Product[] = (res.page?.content || []).map((p: any) => ({
            ...p,
            creationDate: p.creationDate ? new Date(p.creationDate) : null,
            archivedDate: p.archivedDate ? new Date(p.archivedDate) : null,
            buyingDate: p.buyingDate ? new Date(p.buyingDate) : null
          }));
          if (this.isAdmin) {
            if (!selectedWarehouseId) {
              mapped = [];
            } else {
              mapped = mapped.filter(
                (p: Product) => Number((p.warehouse as any)?.warehouseId) === Number(selectedWarehouseId)
              );
            }
          }
          const targetIds = new Set(this.targetProducts.map((t) => t.productId));
          this.purchasePickerFilteredProducts = mapped.filter((p) => !targetIds.has(p.productId!));
          this.totalPurchasePickerGridRecords =
            res.totalProducts ?? res.page?.totalElements ?? res.totalElements ?? 0;
          this.purchasePickerGridLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.purchasePickerGridLoading = false;
          this.purchasePickerFilteredProducts = [];
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_products'),
            life: 3000
          });
        }
      });
  }

  loadMorePurchasePickerGrid(): void {
    if (!this.selectedPurchasePickerCategory?.categoryId) {
      return;
    }
    const loaded = this.lastPurchasePickerLazyLoad.first! + this.purchasePickerFilteredProducts.length;
    if (loaded >= this.totalPurchasePickerGridRecords) {
      return;
    }
    this.lastPurchasePickerLazyLoad = {
      ...this.lastPurchasePickerLazyLoad,
      first: this.lastPurchasePickerLazyLoad.first! + (this.lastPurchasePickerLazyLoad.rows ?? 24)
    };
    const warehouseId = this.isAdmin ? this.getSelectedPurchaseWarehouseId() : undefined;
    if (this.isAdmin && warehouseId == null) {
      return;
    }

    this.purchasePickerGridLoading = true;
    this.productService.loadToken();
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastPurchasePickerLazyLoad;
    const productFilters: { [k: string]: any } = filters ? { ...filters } : {};
    if (this.isAdmin && warehouseId != null) {
      productFilters['warehouseId'] = { value: warehouseId };
    }
    const page = (first ?? 0) / (rows ?? 24);
    const size = rows ?? 24;
    const direction = sortOrder === -1 ? 'DESC' : 'ASC';

    this.productService
      .getProductsPaginated(page, size, globalFilter || '', sortField || 'name', direction, productFilters)
      .subscribe({
        next: (res: any) => {
          const selectedWarehouseId = this.getSelectedPurchaseWarehouseId();
          let mapped: Product[] = (res.page?.content || []).map((p: any) => ({
            ...p,
            creationDate: p.creationDate ? new Date(p.creationDate) : null,
            archivedDate: p.archivedDate ? new Date(p.archivedDate) : null,
            buyingDate: p.buyingDate ? new Date(p.buyingDate) : null
          }));
          if (this.isAdmin && selectedWarehouseId) {
            mapped = mapped.filter(
              (p: Product) => Number((p.warehouse as any)?.warehouseId) === Number(selectedWarehouseId)
            );
          }
          const targetIds = new Set(this.targetProducts.map((t) => t.productId));
          const pageRows = mapped.filter((p) => !targetIds.has(p.productId!));
          const existingIds = new Set(this.purchasePickerFilteredProducts.map((p) => p.productId));
          const merged = [...this.purchasePickerFilteredProducts];
          for (const p of pageRows) {
            if (!existingIds.has(p.productId)) {
              merged.push(p);
              existingIds.add(p.productId);
            }
          }
          this.purchasePickerFilteredProducts = merged;
          this.purchasePickerGridLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.purchasePickerGridLoading = false;
        }
      });
  }

  filterPurchasePickerProducts(event: any): void {
    const query = (event?.query || '').trim();
    const requestToken = ++this.latestPurchaseSuggestionToken;
    const warehouseId = this.isAdmin ? this.getSelectedPurchaseWarehouseId() : undefined;
    if (this.isAdmin && warehouseId == null) {
      this.purchasePickerProductSuggestions = [];
      this.purchasePickerProductSuggestionsLoading = false;
      return;
    }

    this.purchasePickerProductSuggestionsLoading = true;
    this.productService.searchDistinctProductsForPurchase(query, warehouseId).subscribe({
      next: (response: any) => {
        if (requestToken !== this.latestPurchaseSuggestionToken) {
          return;
        }
        const list: Product[] = Array.isArray(response) ? response : [];
        this.purchasePickerProductSuggestions = this.preparePurchasePickerSuggestions(list);
        this.purchasePickerProductSuggestionsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        if (requestToken !== this.latestPurchaseSuggestionToken) {
          return;
        }
        this.purchasePickerProductSuggestions = [];
        this.purchasePickerProductSuggestionsLoading = false;
      }
    });
  }

  private preparePurchasePickerSuggestions(products: Product[]): Product[] {
    const selectedWarehouseId = this.getSelectedPurchaseWarehouseId();
    const selectedIds = new Set(this.targetProducts.map((p) => p.productId));
    return (products || []).filter(
      (product) =>
        (!this.isAdmin ||
          (selectedWarehouseId != null &&
            Number((product.warehouse as any)?.warehouseId) === Number(selectedWarehouseId))) &&
        !selectedIds.has(product.productId)
    );
  }

  onPurchasePickerProductSelect(_event: any): void {
    const selected = this.purchasePickerSelectedProduct;
    if (!selected) {
      return;
    }
    this.moveProductToTarget(selected);
    this.purchasePickerSelectedProduct = null;
  }

  async onLoadQuickPurchaseProducts(): Promise<void> {
    const warehouseId = this.isAdmin ? this.getSelectedPurchaseWarehouseId() : undefined;
    if (this.isAdmin && warehouseId == null) {
      this.quickPurchaseProducts = [];
      return;
    }
    try {
      const response = await firstValueFrom(this.productService.getQuickProducts());
      const list: Product[] = Array.isArray(response) ? response : [];
      this.quickPurchaseProducts = list.filter((product) =>
        !this.isAdmin ||
        (warehouseId != null &&
          Number((product.warehouse as any)?.warehouseId) === Number(warehouseId))
      );
    } catch {
      this.quickPurchaseProducts = [];
    }
    this.cdr.markForCheck();
  }

  onPurchaseWarehouseChange(): void {
    this.targetProducts = [];
    this.purchaseItems = [];
    this.resetPurchasePickerUi();
    void this.onLoadQuickPurchaseProducts();
  }

  private getSelectedPurchaseWarehouseId(): number | undefined {
    if (!this.selectedPurchaseWarehouse) return undefined;
    const rawId = (this.selectedPurchaseWarehouse as any).warehouseId ?? (this.selectedPurchaseWarehouse as any).id;
    if (rawId == null) return undefined;
    const id = Number(rawId);
    return Number.isNaN(id) ? undefined : id;
  }

  viewProductDetails(product: Product) {
    if (!product) return;
    this.router.navigate(['/inventory/products', product.productId]);
  }

  quantityInputStep(product: Product): number {
    return lineQuantityStep(product);
  }

  quantityInputDecimals(product: Product): number {
    return lineQuantityDecimals(product);
  }

  lineQuantityMin(product: Product): number {
    return lineQtyMin(product);
  }

  formatLineQuantity(product: Product, quantity: number | null | undefined): string {
    return formatLineQty(product, quantity);
  }

  displayProductStock(product: Product): number {
    return displayProductStockQuantity(product);
  }

  getMeasureUnit(product: Product, quantity?: number): string {
    const qty = quantity ?? product.purchaseItemQuantity ?? displayProductStockQuantity(product);
    return getLineMeasureUnit(product, qty);
  }

  getQuantitySeverity(quantity: number): string {
    return getQuantitySeverity(quantity, this.lowStockThreshold);
  }

  async getLowStockThreshold(): Promise<number> {
    return await getLowStockThreshold(this.configService);
  }

  displayAttributeValue(attr: any): string {
    return displayAttributeValue(attr);
  }

  calculateProfit(product: Product): number {
    return calculateProfit(product);
  }

  editProduct(product: Product) {
    if (!this.canEditProduct) return;
    this.selectedProduct = product;
    this.product = { ...product };
    this.refreshPurchasePickerCatalog();
    this.initializePickList();
    this.onGetAllShops();
    this.onGetAllSuppliers();
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.productDialog = true;
    this.scanning = false;
  }

  // Method to open product dialog for adding new product
  openNewProduct(): void {
    if (!this.canAddProduct) return;
    this.product = {};
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.onGetAllSuppliers();
    this.productDialog = true;
    this.scanning = false;
  }

  deleteProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.product = { ...product };
    this.deleteProductDialog = true;
  }

  archiveProduct(product: Product) {
    if (!this.canArchiveProduct) return;
    this.archiveProductDialog = true;
    this.product = { ...product };
    this.productDialog = false;
  }

  async confirmArchive() {
    if (!this.canArchiveProduct) return;
    this.archiveProductDialog = false;
    await this.onArchiveProduct(this.product.productId);
    this.product = {};
    this.selectedProduct = {};
  }

  async onProductDeleteConfirmed(productId: number) {
    if (!this.canDeleteProduct) return;
    await this.onDeleteProduct(productId);
    this.product = {};
  }

  hideProductDialog() {
    this.productDialog = false;
    this.scanning = true;
    this.submitted = false;
  }

  // Handler for product form save success event
  onProductFormSaveSuccess(product: Product): void {
    this.refreshPurchasePickerCatalog();
    void this.loadPurchasePickerCategories();
    this.product = {};
  }

  // Handler for product form save error event
  onProductFormSaveError(error: any): void {
    // Error message is already shown by the form component
    // Just log for debugging if needed
    console.error('Product save error:', error);
  }

  // Load categories for product form
  async onGetAllCategories(): Promise<void> {
    await this.categoryService.getCategories().subscribe({
      next: (response: any) => {
        this.categories = response;
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_categories'),
          life: 3000,
        });
        console.log(err);
      },
    });
  }

  // Load warehouses for product form
  async onGetAllWarehouses(): Promise<void> {
    await this.warehouseService.getWarehouses().subscribe({
      next: (response: any) => {
        this.warehouses = response;
        if (this.isAdmin && !this.selectedPurchaseWarehouse && Array.isArray(this.warehouses) && this.warehouses.length === 1) {
          this.selectedPurchaseWarehouse = this.warehouses[0];
          this.refreshPurchasePickerCatalog();
        }
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_warehouses'),
          life: 3000,
        });
        console.log(err);
      },
    });
  }

  // Dialog methods for adding new entities (can be empty or show dialogs)
  openCategoryDialog(): void {
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: 'Category quick add is not available in this form yet.',
      life: 3000,
    });
  }

  openSupplierDialog(): void {
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: 'Supplier quick add is not available in this form yet.',
      life: 3000,
    });
  }

  openWarehouseDialog(): void {
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: 'Warehouse quick add is not available in this form yet.',
      life: 3000,
    });
  }

  openShopDialog(): void {
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: 'Shop quick add is not available in this form yet.',
      life: 3000,
    });
  }

  async onDeleteProduct(id: any) {
    await this.productService.deleteProduct(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_deleted'),
            life: 3000
          });
          this.refreshPurchasePickerCatalog();
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_deleting_product'),
            life: 3000
          });
          console.log(err);
        },
      })
  }

  async onArchiveProduct(id: any) {
    await this.productService.deactivateProduct(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_archived'),
            life: 3000
          });
          this.refreshPurchasePickerCatalog();
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_archiving_product'),
            life: 3000
          });
          console.log(err);
        },
      })
  }

  // async onFileUpload(event: any): Promise<void> {
  //   const file = event.files[0];

  //   if (!file) return;

  //   // Validate file type
  //   if (!file.type.startsWith('image/')) {
  //     this.messageService.add({
  //       severity: 'error',
  //       summary: this.translate.instant('error'),
  //       detail: this.translate.instant('invalid_image_format'),
  //       life: 3000,
  //     });
  //     return;
  //   }

  //   // Validate file size (5MB max)
  //   if (file.size > 5000000) {
  //     this.messageService.add({
  //       severity: 'error',
  //       summary: this.translate.instant('error'),
  //       detail: this.translate.instant('image_too_large'),
  //       life: 3000,
  //     });
  //     return;
  //   }

  //   // Show loading state
  //   this.isImageLoading = true;

  //   // Create preview
  //   this.imagePreviewUrl = URL.createObjectURL(file);

  //   // Store the file for upload
  //   this.uploadedFile = file;

  //   // Auto-hide loading after a brief moment (image load event will handle it)
  //   setTimeout(() => {
  //     if (this.isImageLoading) this.isImageLoading = false;
  //   }, 2000);
  // }

  // Drag and drop handlers
  // onDragOver(event: DragEvent): void {
  //   event.preventDefault();
  //   event.stopPropagation();
  //   this.isDragOver = true;
  // }

  // onDragLeave(event: DragEvent): void {
  //   event.preventDefault();
  //   event.stopPropagation();
  //   this.isDragOver = false;
  // }

  // onDrop(event: DragEvent): void {
  //   event.preventDefault();
  //   event.stopPropagation();
  //   this.isDragOver = false;

  //   if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
  //     const file = event.dataTransfer.files[0];

  //     // Create a mock event object for the fileUpload method
  //     this.onFileUpload({ files: [file] });
  //   }
  // }

  // Image error handler
  // onImageError(): void {
  //   this.isImageLoading = false;
  //   this.messageService.add({
  //     severity: 'error',
  //     summary: this.translate.instant('error'),
  //     detail: this.translate.instant('image_load_error'),
  //     life: 3000,
  //   });

  //   // Fallback to default image
  //   this.imagePreviewUrl = null;
  //   this.product.productImage = 'assets/core-images/no-image.png';
  // }

  // Zoom image
  // zoomImage(): void {
  //   this.imageZoomDialog = true;
  // }

  // Select recent image
  // selectRecentImage(imageUrl: string): void {
  //   this.product.productImage = imageUrl;
  //   this.imagePreviewUrl = null;
  //   this.uploadedFile = null;
  // }

  // Enhanced editImage method
  // editImage(): void {
  //   this.product.productImage = null;
  //   this.imagePreviewUrl = null;
  //   this.uploadedFile = null;
  // }

  // Enhanced removeImage method
  // removeImage(): void {
  //   this.product.productImage = null;
  //   this.imagePreviewUrl = null;
  //   this.uploadedFile = null;
  // }

  // async saveProduct() {
  //   this.submitted = true;

  //   if (
  //     this.product.name &&
  //     this.product.reference &&
  //     this.product.buyingPrice &&
  //     this.product.sellingPrice &&
  //     this.product.category &&
  //     this.product.supplier
  //   ) {
  //     if (this.isAdmin && !this.product.warehouse) {
  //       this.messageService.add({
  //         severity: 'error',
  //         summary: this.translate.instant('error'),
  //         detail: this.translate.instant('warehouse_required'),
  //         life: 3000,
  //       });
  //       return;
  //     }

  //     // 🔍 Check for duplicate product with same reference in the same warehouse
  //     const isDuplicate = this.products.some(p =>
  //       p.reference === this.product.reference &&
  //       p.warehouse?.warehouseId === this.product.warehouse?.warehouseId &&
  //       p.productId !== this.product.productId // exclude current product if updating
  //     );

  //     if (isDuplicate) {
  //       this.messageService.add({
  //         severity: 'warn',
  //         summary: this.translate.instant('warning'),
  //         detail: this.translate.instant('product_already_exists_in_warehouse'),
  //         life: 4000,
  //       });
  //       return;
  //     }

  //     // 📦 Upload product image if any (only if it's a new file)
  //     if (this.uploadedFile && this.uploadedFile !== this.existingImageFile) {
  //       this.isSaving = true; // Show saving indicator

  //       try {
  //         const filePath = `images/${Date.now()}_${this.uploadedFile.name}`;
  //         const fileRef = this.storage.ref(filePath);
  //         const task = this.storage.upload(filePath, this.uploadedFile);

  //         // Show upload progress
  //         task.percentageChanges().subscribe(percentage => {
  //           this.uploadProgress = percentage;
  //         });

  //         await lastValueFrom(task.snapshotChanges());
  //         const url = await lastValueFrom(fileRef.getDownloadURL());
  //         this.product.productImage = url;

  //         // Add to recent images
  //         this.addToRecentImages(url);

  //       } catch (error) {
  //         console.error('Error uploading file:', error);
  //         this.messageService.add({
  //           severity: 'error',
  //           summary: this.translate.instant('error'),
  //           detail: this.translate.instant('error_while_uploading_image'),
  //           life: 3000,
  //         });
  //         this.isSaving = false;
  //         return;
  //       } finally {
  //         this.uploadedFile = null;
  //         this.uploadProgress = 0;
  //       }
  //     }

  //     // Clean attributes before saving
  //     if (this.product.attributes && this.product.attributes.length > 0) {
  //       this.product.attributes.forEach(attr => {
  //         // strip transient field if it still exists
  //         delete attr.value;

  //         // optionally normalize booleans (Angular checkboxes can send null)
  //         if (attr.attributeType === 'BOOLEAN' && attr.booleanValue == null) {
  //           attr.booleanValue = false;
  //         }
  //       });
  //     }

  //     // ✏️ Update or add product
  //     if (this.product.productId) {
  //       this.updateProduct(this.product.productId, this.product)
  //         ? this.messageService.add({
  //           severity: 'success',
  //           summary: this.translate.instant('successful'),
  //           detail: this.translate.instant('product_updated'),
  //           life: 3000,
  //         })
  //         : this.messageService.add({
  //           severity: 'error',
  //           summary: this.translate.instant('error'),
  //           detail: this.translate.instant('error_while_updating_product'),
  //           life: 3000,
  //         });
  //     } else {
  //       this.addProduct(this.product);
  //     }

  //     // ✅ Reset and close dialog
  //     this.productDialog = false;
  //     this.product = {};
  //   } else {
  //     this.messageService.add({
  //       severity: 'error',
  //       summary: this.translate.instant('error'),
  //       detail: this.translate.instant('please_fill_required_fields'),
  //       life: 3100,
  //     });
  //     return;
  //   }
  // }

  // addToRecentImages(imageUrl: string): void {
  //   // Keep only the 6 most recent images
  //   this.recentProductImages = [imageUrl, ...this.recentProductImages].slice(0, 6);

  //   // You might want to persist this to local storage
  //   localStorage.setItem('recentProductImages', JSON.stringify(this.recentProductImages));
  // }

  // async updateProduct(id: any, product: any): Promise<any> {
  //   console.log(product)
  //   await this.productService.updateProduct(id, product)
  //     .subscribe({
  //       next: (response: any) => {
  //         console.log(response);
  //         this.loadProductsForPicker();
  //         return true;
  //       },
  //       error: (err: any) => {
  //         this.messageService.add({
  //           severity: 'error',
  //           summary: this.translate.instant('error'),
  //           detail: this.translate.instant('error_while_updating_product'),
  //           life: 3000
  //         });
  //         console.log(err);
  //         return false;
  //       },
  //     })
  // }

  // async addProduct(data: any): Promise<any> {
  //   console.log(data);
  //   await this.productService.saveProduct(data)
  //     .subscribe({
  //       next: (response: any) => {
  //         console.log(response);
  //         this.loadProductsForPicker();
  //         this.messageService.add({
  //           severity: 'success',
  //           summary: this.translate.instant('successful'),
  //           detail: this.translate.instant('product_added'),
  //           life: 3000
  //         });
  //         return true;
  //       },
  //       error: (err: any) => {
  //         this.messageService.add({
  //           severity: 'error',
  //           summary: this.translate.instant('error'),
  //           detail: this.translate.instant('error_while_adding_product'),
  //           life: 3000
  //         });
  //         console.log(err);
  //         return false;
  //       },
  //     })
  async loadBankAccounts() {
    if (!this.canReadBankAccounts) {
      this.bankAccounts = [];
      return;
    }
    try {
      const accounts$ = await this.bankAccountService.getBankAccounts(true);
      const response = await firstValueFrom(accounts$);
      this.bankAccounts = response as BankAccount[];
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  }

  async togglePaymentSection(): Promise<void> {
    this.showPaymentSection = !this.showPaymentSection;

    if (this.showPaymentSection) {
      // Initialize payment with current total if not set
      if (!this.payment.amount || this.payment.amount === 0) {
        this.payment.amount = this.calculateTotalAmount();
      }

      // Set payment date to today if not set
      if (!this.payment.paymentDate) {
        this.payment.paymentDate = new Date();
      }

      if (!this.payment.paymentMethod) {
        this.payment.paymentMethod = 'Cash';
      }

      await this.updateBankAccountFieldVisibility();
    }
  }

  async updateBankAccountFieldVisibility() {
    if (!this.payment.paymentMethod) {
      this.showBankAccountField = false;
      this.isBankAccountRequired = false;
      this.minimumAmountHint = null;
      this.bankAccountNoticeKey = null;
      return;
    }

    const isBankMethod = this.paymentValidationService.isBankMethod(this.payment.paymentMethod);
    this.showBankAccountField = this.canReadBankAccounts
      ? await this.paymentValidationService.shouldShowBankAccountField(this.payment.paymentMethod)
      : false;
    this.isBankAccountRequired = await this.paymentValidationService.isBankAccountRequired(this.payment.paymentMethod);
    this.minimumAmountHint = await this.paymentValidationService.getMinimumAmountHint(this.payment.paymentMethod, this.currency);
    this.bankAccountNoticeKey = null;

    // Pre-populate bank account from shop's default if available
    if (isBankMethod && !this.payment.bankAccountId) {
      const shopDefaultAccountId = this.getPurchaseShopDefaultBankAccountId();
      if (shopDefaultAccountId != null) {
        const defaultAccount = this.bankAccounts.find(acc => acc.accountId === shopDefaultAccountId);
        this.payment.bankAccountId = defaultAccount?.accountId ?? shopDefaultAccountId;
      }
    }

    if (isBankMethod && !this.canReadBankAccounts) {
      if (this.payment.bankAccountId) {
        this.bankAccountNoticeSeverity = 'info';
        this.bankAccountNoticeKey = 'shop_default_bank_account_will_be_used';
      } else {
        this.bankAccountNoticeSeverity = 'warn';
        this.bankAccountNoticeKey = 'no_default_bank_account_assigned_to_shop';
      }
    }
  }

  async onPaymentMethodChange() {
    await this.updateBankAccountFieldVisibility();
  }

  private getPurchaseShopDefaultBankAccountId(): number | undefined {
    const shop = this.resolvePurchasePaymentShop();
    const raw = shop?.defaultBankAccount?.accountId ?? shop?.defaultBankAccountId;
    if (raw == null) {
      return undefined;
    }
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : undefined;
  }

  private resolvePurchasePaymentShop(): Shop | undefined {
    const currentShopId = this.toPositiveNumber(this.purchase?.shop?.shopId);
    if (currentShopId != null) {
      const latest = this.shops.find(shop => this.toPositiveNumber(shop.shopId) === currentShopId);
      if (latest) {
        this.purchase.shop = latest;
        return latest;
      }
      return this.purchase.shop;
    }

    if (!this.isAdmin) {
      const userShopId = this.getCurrentUserShopIdFromToken();
      const tokenShop = userShopId != null
        ? this.shops.find(shop => this.toPositiveNumber(shop.shopId) === userShopId)
        : undefined;
      if (tokenShop) {
        this.purchase.shop = tokenShop;
        return tokenShop;
      }
    }

    if (Array.isArray(this.shops) && this.shops.length === 1) {
      this.purchase.shop = this.shops[0];
      return this.shops[0];
    }

    return undefined;
  }

  private getCurrentUserShopIdFromToken(): number | undefined {
    const tokenParsed = this.keycloakService.getKeycloakInstance()?.tokenParsed as any;
    for (const key of ['shop', 'shopId', 'shop_id']) {
      const value = this.readTokenClaimValue(tokenParsed, key);
      const id = this.toPositiveNumber(value);
      if (id != null) {
        return id;
      }
    }
    return undefined;
  }

  private readTokenClaimValue(source: any, key: string): any {
    if (!source) {
      return undefined;
    }
    const direct = source[key];
    if (direct != null) {
      return Array.isArray(direct) ? direct[0] : direct;
    }
    for (const container of ['attributes', 'user_attributes']) {
      const nested = source[container];
      const nestedValue = nested?.[key];
      if (nestedValue != null) {
        return Array.isArray(nestedValue) ? nestedValue[0] : nestedValue;
      }
    }
    return undefined;
  }

  private toPositiveNumber(value: any): number | undefined {
    if (value == null || String(value).trim() === '') {
      return undefined;
    }
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
  }

  private ensureBankAccountObjectForPayload(): void {
    if (!this.payment.bankAccountId) {
      delete (this.payment as any).bankAccount;
      return;
    }

    const selectedBankAccount = this.bankAccounts.find(acc => acc.accountId === this.payment.bankAccountId);
    (this.payment as any).bankAccount = selectedBankAccount || { accountId: this.payment.bankAccountId };
  }

  private async prepareBankPaymentContext(): Promise<boolean> {
    if (!this.paymentValidationService.isBankMethod(this.payment.paymentMethod || '')) {
      this.payment.bankAccountId = undefined;
      delete (this.payment as any).bankAccount;
      this.bankAccountNoticeKey = null;
      return true;
    }

    if (!this.canReadBankAccounts && !this.payment.bankAccountId) {
      this.payment.bankAccountId = this.getPurchaseShopDefaultBankAccountId();
    }

    const requireAccount = await this.paymentValidationService.isBankAccountRequired(this.payment.paymentMethod || '');
    if (requireAccount && !this.payment.bankAccountId && !this.canReadBankAccounts) {
      this.bankAccountNoticeSeverity = 'warn';
      this.bankAccountNoticeKey = 'no_default_bank_account_assigned_to_shop';
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('no_default_bank_account_assigned_to_shop'),
        life: 4000
      });
      return false;
    }

    this.ensureBankAccountObjectForPayload();
    await this.updateBankAccountFieldVisibility();
    return true;
  }

  async validatePayment(): Promise<boolean> {
    if (!this.payment.amount || !this.payment.paymentMethod || !this.payment.paymentDate) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000,
      });
      return false;
    }

    if (this.payment.amount < 0.01) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('payment_amount_invalid_min'),
        life: 3000,
      });
      return false;
    }

    if (!(await this.prepareBankPaymentContext())) {
      return false;
    }

    // Validate bank account and minimum amount using validation service
    const validation = await this.paymentValidationService.validateBankPayment(
      this.payment.paymentMethod || '',
      this.payment.bankAccountId,
      this.payment.amount,
      'payment'
    );

    if (!validation.valid) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: validation.error || this.translate.instant('validation_error')
      });
      return false;
    }

    return true;
  }

  async processPaymentForPurchase(purchase: Purchase): Promise<void> {
    if (!purchase || !purchase.purchaseId) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_select_purchase')
      });
      return;
    }

    if (!this.payment.amount || !this.payment.paymentMethod || !this.payment.paymentDate) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    if (!(await this.prepareBankPaymentContext())) {
      return;
    }

    // Validate bank account and minimum amount using validation service
    const validation = await this.paymentValidationService.validateBankPayment(
      this.payment.paymentMethod || '',
      this.payment.bankAccountId,
      this.payment.amount,
      'payment'
    );

    if (!validation.valid) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: validation.error || this.translate.instant('validation_error')
      });
      return;
    }

    // Set payment details
    this.payment.purchase = purchase;
    this.payment.supplier = purchase.supplier;
    this.payment.direction = 'OUTGOING';

    // Format dates
    if (this.payment.paymentDate) {
      const date = typeof this.payment.paymentDate === "string" ? new Date(this.payment.paymentDate) : this.payment.paymentDate;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      this.payment.paymentDate = `${year}-${month}-${day}`;
    }

    if (this.payment.checkExpirationDate) {
      const date = typeof this.payment.checkExpirationDate === "string" ? new Date(this.payment.checkExpirationDate) : this.payment.checkExpirationDate;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      this.payment.checkExpirationDate = `${year}-${month}-${day}`;
    }

    if (this.payment.boeExpirationDate) {
      const date = typeof this.payment.boeExpirationDate === "string" ? new Date(this.payment.boeExpirationDate) : this.payment.boeExpirationDate;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      this.payment.boeExpirationDate = `${year}-${month}-${day}`;
    }

    // Add bankAccount object if bankAccountId is present (backend expects this)
    this.ensureBankAccountObjectForPayload();

    try {
      await this.paymentService.savePayment(this.payment).toPromise();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('payment_added'),
        life: 3000
      });
      this.showPaymentSection = false;
      this.payment = {};
      await this.onGetAllPurchases();
    } catch (error) {
      console.error('Error processing payment:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_processing_payment'),
        life: 3000
      });
    }
  }
}
