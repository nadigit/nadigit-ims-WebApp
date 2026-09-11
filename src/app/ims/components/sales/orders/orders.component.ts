import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnChanges, OnDestroy, OnInit, Pipe, PipeTransform, SimpleChanges, ViewChild } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { MessageService, SelectItem, MenuItem, LazyLoadEvent } from 'primeng/api';
import { Table } from 'primeng/table';
import { OrderService } from 'src/app/services/order.service';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import { Product } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';
import { BarcodeService } from 'src/app/services/barcode.service';
import { CustomerService } from 'src/app/services/customer.service';
import { Customer } from 'src/app/models/customer';
import { Order } from 'src/app/models/order';
import { OrderItem } from 'src/app/models/orderItem';
import { LineOptionSet, LineOption } from 'src/app/models/line-option-set';
import { LineOptionSetService } from 'src/app/services/line-option-set.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { LocationService } from 'src/app/services/location.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TaxRuleService } from 'src/app/services/tax-rule.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Shop } from 'src/app/models/shop';
import { ShopService } from 'src/app/services/shop.service';
import { Warehouse } from 'src/app/models/warehouse';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { OrganizationService } from 'src/app/services/organization.service';
import { OrderReturn } from 'src/app/models/orderReturn';
import { Payment } from 'src/app/models/payment';
import { PaymentService } from 'src/app/services/payment.service';
import { CategoryService } from 'src/app/services/category.service';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { firstValueFrom, lastValueFrom, Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import { getPaymentMethodLabel, getPaymentMethodSeverity, getPaymentStatusSeverity } from 'src/app/shared/payment-utils';
import {
  getMeasureUnit,
  getQuantitySeverity,
  getAvailableQuantity,
  hasWriteOffs,
  getWriteOffQuantity,
  buildOrderItemPayload,
  lineQuantityStep,
  lineQuantityDecimals,
  formatProductStockLabel,
  lineQuantityMin as lineQtyMin,
  defaultLineQuantity as defaultLineQty,
  formatLineQuantity as formatLineQty,
  getLineMeasureUnit,
  getOrderItemDisplayQuantity,
  getOrderItemDisplayReturnedQuantity,
  getOrderItemDisplayRemainingQuantity,
  getProductTypeBadgeIcon,
  getProductTypeBadgeKey,
  getProductTypeBadgeSeverity,
} from 'src/app/shared/product-utils';
import { QuantityScale } from 'src/app/utils/quantity-scale.util';
import { getProductVariantSummary as buildProductVariantSummary, isFashionVariantMissing as isFashionVariantMissingUtil } from 'src/app/shared/variant-summary.utils';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { BankAccount } from 'src/app/models/bank-account';
import { PaymentValidationService } from 'src/app/services/payment-validation.service';
import { CustomerCreditService } from 'src/app/services/customer-credit.service';
import { CreditInfo } from 'src/app/models/credit-info';
import { PricingService } from 'src/app/services/pricing.service';
import { PriceListItemDTO, CustomerPriceOverrideDTO } from 'src/app/models/pricing';
import { DatePipe } from '@angular/common';
import { Organization } from 'src/app/models/organization';
import { ProcessModeService } from 'src/app/services/process-mode.service';
import { StockReservationService } from 'src/app/services/stock-reservation.service';
import { ActivityProfileService } from 'src/app/services/activity-profile.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { ShopFormDialogConfig, ShopFormDialogData } from '../../inventory/shops/shop-form-dialog/shop-form-dialog.component';
import {
  initTablePageSizeState,
  persistTablePageSizeFromLazyEvent,
  TablePageSizeKeys,
} from 'src/app/utils/table-page-size.storage';

interface EventItem {
  status?: string;
  date?: string;
  icon?: string;
  color?: string;
  image?: string;
  button?: string;
  buttonDescription?: string
}

@Pipe({
  name: 'filterProducts'
})
export class FilterProductsPipe implements PipeTransform {
  transform(source: any[], selectedProducts: any[]): any[] {
    // Your filtering logic here
    return source.filter(product => !selectedProducts.includes(product));
  }
}

interface LazyLoadEventExt extends LazyLoadEvent {
  globalFilter?: string;
  filters?: { [field: string]: any };
}

import { resolvePublicAssetUrl } from 'src/app/shared/product-image.utils';

@Component({
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css', '../sales.component.css'],
  providers: [MessageService, DatePipe]
})
export class OrdersComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {

  /** Display-ready URL for a category's stored (relative) image. */
  categoryImageUrl(category: any): string {
    return resolvePublicAssetUrl(category?.categoryImage);
  }

  @ViewChild('pickList') pickList: ElementRef | undefined;

  Ressource: string = 'ORDERS';

  currency: any;

  events: EventItem[];

  orderDialog: boolean = false;


  customerDialog: boolean = false;

  shopDialogConfig: ShopFormDialogConfig = {
    visible: false,
    mode: 'create',
    shop: {},
  };

  orderReturnDialog: boolean = false;

  deleteOrderDialog: boolean = false;

  deleteOrdersDialog: boolean = false;

  invoiceDialog: boolean = false;

  products: Product[] = [];

  customers: Customer[] = [];

  customer: Customer = {};

  shops: Shop[] = [];
  warehouses: Warehouse[] = [];
  selectedOrderWarehouse: Warehouse | null = null;

  shop: Shop = {};

  product: Product = {};

  orders: Order[] = [];

  order: Order = {};

  selectedProducts: Product[] = [];

  otherTemplate: Product[] = [];

  selectedOrders: Order[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  paymentStatuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  sortOptions: SelectItem[] = [];

  sortOrder: number = 0;

  sortField: string = '';

  sourceCities: any[] = [];

  targetCities: any[] = [];

  orderCities: any[] = [];

  menuItems: MenuItem[] = [];

  items: MenuItem[] | undefined;

  sourceProducts: Product[] = [];

  targetProducts: Product[] = [];

  orderItems: OrderItem[] = [];

  // --- Sale-line options (components/cuts) ---
  /** All active option sets in the org, fetched once. Applicability (product/category/global) is
   *  resolved client-side because the backend's per-product endpoint returns product-scoped only. */
  private allOptionSetsCache: LineOptionSet[] | null = null;
  optionsDialogVisible = false;
  optionsLine: any = null;

  expandedRows: { [key: string]: boolean } = {}; // Keep track of expanded rows

  exportColumns!: ExportColumn[];

  countries: any[] = [];

  selectedCountry: any = null;

  states: any = null;

  originalEvents: any[];

  statusDate: any;
  userRoles: any;
  isAdmin: boolean = false;

  /** When sales process mode is DOCUMENT_CHAIN, page copy uses document-oriented labels. */
  salesDocumentChainMode = false;

  /** Read-only stepper in the order dialog when editing an existing order in document-chain mode. */
  orderDialogDocumentChainSteps: MenuItem[] = [];
  orderDialogDocumentChainActiveIndex = 0;

  selectedItems: any[] = [];  // Selected order items for return

  discountType: 'Amount' | 'Percentage'; // Default type is "amount"

  returnReason: string = '';
  returnNotes: string | null = null;

  orderReturns: OrderReturn[] = [];

  orderPayments: Payment[] = [];

  receiptDialogVisible: boolean = false;

  receiptData: { order: Order; payment: Payment } = { order: {}, payment: {} };

  loadingReceipt: boolean = false;

  /** URL ?orderStatus= values we honor (document-chain stages / list filter). */
  private static readonly URL_ORDER_STATUSES = ['Ordered', 'Processing', 'Delivered', 'Completed'] as const;

  statusSequences: { [key: string]: string[] } = {
    'Ordered': ['Processing', 'Canceled'],
    'Processing': ['Delivered'],
    'Delivered': ['Completed'],
    'Completed': ['Return_Pending'],
    'Return_Pending': ['Returned', 'Partial_Return'],
    'Canceled': [],
    'Returned': [],
    'Partial_Return': [],
  };

  images: any[];

  responsiveOptions: any[] = [
    {
      breakpoint: '1024px',
      numVisible: 5
    },
    {
      breakpoint: '768px',
      numVisible: 3
    },
    {
      breakpoint: '560px',
      numVisible: 1
    }
  ];

  loading: boolean = false;

  barcode: string = '';

  scanTimeout: any;
  private readonly barcodeIdleMs = 120;
  private readonly barcodeMinLength = 4;
  private lastBarcodeKeyAt = 0;
  private barcodeLookupInProgress = false;

  scanning: boolean = false;

  private latestProductSuggestionToken = 0;

  TaxEnabledOptions: any[] = [];

  taxEnabled: boolean = false;

  /** True when tax.calculation.mode = RULES (per-line tax rule engine active). */
  taxRulesMode: boolean = false;
  /** True when pricing.tax.inclusive = true (prices are TTC; tax extracted, not added). */
  taxInclusive: boolean = false;
  private taxResolveSignature = '';
  private taxResolveSeq = 0;

  taxRate: number = 0.0;

  discountTypeOptions: any;

  organization: any;

  showPaymentSection: boolean = false;

  payment: Payment = {};

  isSavingPayment: boolean = false;

  paymentMethods: any;

  bankAccounts: BankAccount[] = [];
  canReadBankAccounts: boolean = false;
  showBankAccountField: boolean = false;
  isBankAccountRequired: boolean = false;
  minimumAmountHint: string | null = null;
  bankAccountNoticeKey: string | null = null;
  bankAccountNoticeSeverity: 'info' | 'warn' = 'info';
  creditInfo: CreditInfo | null = null;
  creditAmountUsed: number = 0;
  
  // ⚠️ NEW: Explicit credit selection properties
  useCredit: boolean = false;
  creditAmountToUse: number | null = null;
  creditLimitExceeded: boolean = false;
  creditLimitError: string | null = null;
  
  // Outstanding balance properties (from creditInfo)
  outstandingBalance: number = 0;
  overdueBalance: number = 0;
  netBalance: number = 0;
  availableCreditLimit: number = 0;

  orderReturnsMap: Map<number, OrderReturn[]> = new Map();
  loadingReturns: Set<number> = new Set();

  // Customer pricing data (new API-based approach)
  customerPricing: {
    customerId?: number;
    customerName?: string;
    priceListId?: number;
    priceListName?: string;
    defaultQuantity?: number;
    prices?: { [productId: number]: number };
    priceSources?: { [productId: number]: string };
  } | null = null;

  // Price override configuration
  priceOverrideAllowed: boolean = true; // Default to true, will be loaded from config

  /** When true, sale lines expose a portion selector (whole/half/quarter/...) → OrderItem.portionFraction. */
  portionSelectionEnabled: boolean = false;
  portionOptions: { label: string; value: number }[] = [
    { label: '1', value: 1 },
    { label: '1/2', value: 0.5 },
    { label: '1/4', value: 0.25 },
    { label: '1/8', value: 0.125 },
  ];

  /** When false, UI shows net sellable qty (approved write-offs excluded); matches default backend. */
  salesStockIncludesApprovedWriteoffQty: boolean = false;

  /** When true, new-order dialog syncs soft reservations and sends checkout context on create. */
  salesStockSoftReservationEnabled: boolean = false;

  /** UUID for back-office draft reservations (new orders only). */
  orderCheckoutReservationContextId: string | null = null;

  private reservationSyncTimer: ReturnType<typeof setTimeout> | null = null;

  // UX helper: single-entity flags
  hasSingleCustomer: boolean = false;
  hasSingleShop: boolean = false;

  // Permissions
  canAddCustomer: boolean = false;
  canAddShop: boolean = false;
  canAddPayment: boolean = false;
  canAddOrder: boolean = false;
  canEditOrder: boolean = false;
  canCancelOrder: boolean = false;
  canDeleteOrder: boolean = false;
  canProcessOrder: boolean = false;

  canAddProduct: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canArchiveProduct: boolean = false;
  canReadProduct: boolean = false;
  isLoading: boolean = true;
  isInitialLoad: boolean = true;
  private lazyLoadCallCount = 0;
  isExporting: boolean = false;
  exportProgress: string = '';
  productDetailDialog: boolean = false;
  lowStockThreshold;
  productDialog: boolean = false;
  deleteProductDialog: boolean = false;
  archiveProductDialog: boolean = false;
  // initialInvoiceItems = [{ description: '', quantity: 1, unitPrice: 0 }];
  // taxRates = [{ label: '0%', value: 0 }, { label: '5%', value: 5 }, { label: '10%', value: 10 }, { label: '18%', value: 18 }];

  // Lazy loading properties
  totalRecords: number = 0;
  totalAmount: number = 0;
  totalPaid: number = 0;
  remainingBalance: number = 0;
  totalCost: number = 0;
  totalProfit: number = 0;

  filteredProducts: Product[] = [];
  productSuggestions: Product[] = [];
  productSuggestionsLoading: boolean = false;
  productSearch: string = '';
  selectedProduct: Product | null = null;
  categories: any[] = [];
  suppliers: any[] = [];
  /** Was declared and never assigned, so the quick-add button never appeared when the product
   *  form was opened from an order. */
  canAddCategory: boolean = false;
  canAddSupplier: boolean = false;
  canAddWarehouse: boolean = false;
  selectedCategory: any = null;
  quickProducts: Product[] = [];
  filteredCategories: any[] = [];

  lazyLoading: boolean = true;
  first: number = 0;
  rows: number = 20;
  pageSize: number = 20;
  globalFilter: string = '';
  filters: any = {};
  lastLazyLoadEvent: LazyLoadEventExt = {
    first: 0,
    rows: 20,
    sortField: 'orderDate',
    sortOrder: -1,
    globalFilter: '',
    filters: {}
  };
  lastProductsLazyLoadEvent: LazyLoadEventExt = {
    first: 0,
    rows: 20,
    sortField: 'creationDate',
    sortOrder: -1,
    globalFilter: '',
    filters: {}
  };
  lastSortField: string = 'orderDate';
  lastSortOrder: number = -1; // DESC by default
  lastGlobalFilter: string = '';
  @ViewChild('dt') dt!: Table;
  @ViewChild('filter') filter!: ElementRef;

  // If set, open this order in edit mode after orders are loaded
  private pendingEditOrderId: number | null = null;

  private processFlagsSub?: Subscription;
  private configSavedSub?: Subscription;

  constructor(private messageService: MessageService,
    private orderService: OrderService,
    private productService: ProductService,
    private barcodeService: BarcodeService,
    private customerService: CustomerService,
    private paymentService: PaymentService,
    private bankAccountService: BankAccountService,
    private paymentValidationService: PaymentValidationService,
    private creditService: CustomerCreditService,
    private shopService: ShopService,
    private warehouseService: WarehouseService,
    private cdr: ChangeDetectorRef,
    private configService: AppConfigurationService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private categoryService: CategoryService,
    private supplierService: SupplierService,
    public organizationService: OrganizationService,
    private financialDocService: FinancialDocumentsService,
    private router: Router,
    private pricingService: PricingService,
    private route: ActivatedRoute,
    private datePipe: DatePipe,
    private processModeService: ProcessModeService,
    private stockReservationService: StockReservationService,
    public activityProfileService: ActivityProfileService,
    private locationService: LocationService,
    private taxRuleService: TaxRuleService,
    private lineOptionSetService: LineOptionSetService,
  
    private licenseCapabilitiesService: LicenseCapabilitiesService) {
    this.loadTaxRate();

  }

  generateDocumentNumber(documentType: string, lastDocumentNumber: string): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // Last two digits of the year
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month (01-12)
    const day = String(now.getDate()).padStart(2, '0'); // Day (01-31)
    const datePart = `${year}${month}${day}`;

    // Map document types to prefixes
    const docPrefixes: { [key: string]: string } = {
      Facture: "F",
      Devis: "D",
      "Bon de Livraison": "BL",
      "Bon de Commande": "BC",
      Retour: "BR",
      "Retour Partiel": "BR"
    };

    const prefix = docPrefixes[documentType] || "XX"; // Default to "XX" if type is unknown

    let nextNumber = 1; // Default if no previous document exists

    if (lastDocumentNumber) {
      const lastNumber = parseInt(lastDocumentNumber.slice(-2), 10); // Extract last 2 digits
      nextNumber = isNaN(lastNumber) ? 1 : lastNumber + 1; // Increment if valid
    }

    return `${prefix}-${datePart}${String(nextNumber).padStart(2, '0')}`;
  }

  async ngOnInit() {
    this.isLoading = true;
    initTablePageSizeState(TablePageSizeKeys.orders, this.rowsPerPageOptions, {
      pageSize: this.pageSize,
      rows: this.rows,
      lastLazyLoadEvent: this.lastLazyLoadEvent,
    });
    await this.processModeService.ensureLoaded();
    this.salesDocumentChainMode = this.processModeService.isSalesDocumentChain();

    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });

    const initialQp = this.route.snapshot.queryParamMap;
    this.applyPendingEditOrderIdFromQuery(initialQp);
    this.applyOrderStatusFromQueryParam(initialQp.get('orderStatus'));
    this.applyCreateOrderFromQuery(initialQp);

    this.route.queryParamMap.pipe(skip(1)).subscribe((qm) => {
      this.applyPendingEditOrderIdFromQuery(qm);
      this.applyOrderStatusFromQueryParam(qm.get('orderStatus'));
      this.applyFilters();
    });

    this.processFlagsSub = this.processModeService.processFlagsChanged$.subscribe(() => {
      this.applySalesProcessFlagsAfterSettingsSave();
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
        void this.getLowStockThreshold().then((t) => {
          this.lowStockThreshold = t;
          this.cdr.markForCheck();
        });
        return;
      }
      const reloadStock = key.startsWith('sales.stock');
      const reloadPricing = key === 'pricing.allow.custom.override';
      if (!reloadStock && !reloadPricing) {
        return;
      }
      void (async () => {
        if (reloadStock) {
          await this.loadSalesStockConfig();
          await this.loadSalesStockSoftReservationConfig();
        }
        if (reloadPricing) {
          await this.loadPriceOverrideConfig();
        }
        this.cdr.markForCheck();
      })();
    });

    // Set up translation and events
    this.initializeTranslations();

    this.lowStockThreshold = await this.getLowStockThreshold();
    this.countries = this.locationService.getAllCountriesWithTranslation();

    await this.setUserRoles();

    // Load data
    await Promise.all([
      this.onGetAllCustomers(),
      this.onGetAllShops(),
      this.onGetAllWarehouses(),
      this.onGetAllSuppliers(),
      this.checkPermissions(),
      this.onGetOrganization(),
      this.loadBankAccounts(),
      this.loadPriceOverrideConfig(),
      this.loadSalesStockConfig(),
      this.loadSalesStockSoftReservationConfig(),
      this.loadPortionSelectionConfig(),
    ]);

    // Initialize table columns and statuses
    this.initializeTableColumns();
    this.initializeStatuses();


    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

    // Load first page of orders (respects URL orderStatus via selectedOrderStatus)
    this.applyFilters();
    this.scanning = false;
  }

  ngOnDestroy(): void {
    this.processFlagsSub?.unsubscribe();
    this.configSavedSub?.unsubscribe();
  }

  /** After settings save: sync document-chain UI on this screen and reload list. */
  private applySalesProcessFlagsAfterSettingsSave(): void {
    this.salesDocumentChainMode = this.processModeService.isSalesDocumentChain();
    void this.loadSalesStockSoftReservationConfig();
    if (this.orderDialog) {
      this.refreshOrderDialogDocumentChainSteps();
    }
    this.applyFilters();
    this.cdr.markForCheck();
  }


  onLazyLoad(event: LazyLoadEvent) {
    if (this.isLoading) {
      return;
    }
    this.lazyLoadCallCount++;
    if (this.lazyLoadCallCount === 1 && this.orders.length > 0) {
      this.isInitialLoad = false;
      return;
    }
    const extendedEvent: LazyLoadEventExt = {
      ...event,
      globalFilter: this.globalFilter
    };

    this.updateLastLazyLoadEvent(extendedEvent);
    this.isInitialLoad = false;
    this.isLoading = true;
    this.cdr.markForCheck();
    this.loadOrders();
  }


  loadOrders() {
    this.isLoading = true;
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;

    const page = first! / rows!;
    const size = rows!;
    // PrimeNG convention: sortOrder -1 = descending, 1 = ascending.
    const direction = sortOrder === -1 ? 'DESC' : 'ASC';
    
    // Pass filters as-is - the service expects { field: { value: ..., matchMode: ... } } format
    const filterPayload = filters || {};

    console.log('Loading orders with parameters:', {
      page,
      size,
      sortField,
      direction,
      globalFilter,
      filters: filterPayload
    });

    this.orderService.getOrdersPaginated(
      page,
      size,
      globalFilter || '',
      sortField!,
      direction,
      filterPayload
    ).subscribe({
    next: (res: any) => {
      console.log('Paginated orders response:', res);
      // Defensive: never let an unexpected response shape throw inside next() — that would
      // skip the isLoading/isInitialLoad resets below and hang the table spinner.
      const content = res?.page?.content ?? [];
      // Assign the paginated orders
      this.orders = content.map((o: any) => ({
        ...o,
        orderDate: o.orderDate ? new Date(o.orderDate) : null,
        creationDate: o.creationDate ? new Date(o.creationDate) : null,
        deliveryDate: o.deliveryDate ? new Date(o.deliveryDate) : null,
        completeDate: o.completeDate ? new Date(o.completeDate) : null,
        cancelDate: o.cancelDate ? new Date(o.cancelDate) : null,
        processingDate: o.processingDate ? new Date(o.processingDate) : null,
        expiryDate: o.expiryDate ? new Date(o.expiryDate) : null,
        returnDate: o.returnDate ? new Date(o.returnDate) : null,
        productDetails: o.orderItems
          ?.map((item: any) => `${item.product.name} (Ref: ${item.product.reference})`)
          .join(', ') || ''
      }));

      // Assign totals from backend
      this.totalRecords = res?.totalOrders ?? 0;
      this.totalAmount = res.totalAmount || 0;
      this.totalPaid = res.totalPaid || 0;
      this.remainingBalance = res.remainingBalance || 0;
      this.totalCost = res.totalCost || 0;
      this.totalProfit = res.totalProfit || 0;

      // Load returns if any
      for (let order of this.orders) {
        if (this.hasReturns(order)) {
          this.loadOrderReturns(order);
        }
      }

      // If an edit order was requested (from order details), open it once after data loads
      if (this.pendingEditOrderId) {
        const orderToEdit = this.orders.find(o => o.orderId === this.pendingEditOrderId);
        if (orderToEdit) {
          this.editOrder(orderToEdit);
          this.pendingEditOrderId = null;
        }
      }

      this.isLoading = false;
      // A load has completed — clear the initial-load flag regardless of how it was
      // triggered (applyFilters/queryParam navigation don't go through onLazyLoad). Otherwise
      // an empty result keeps isInitialLoad=true, which leaves the orders-table spinner up
      // forever (it only clears on non-empty results). Seen on document-chain/hybrid quote/PO
      // views, which are legitimately empty here.
      this.isInitialLoad = false;

      // Trigger change detection to ensure table updates
      if (this.cdr) {
        this.cdr.detectChanges();
      }
    },
    error: (err: any) => {
      console.error(err);
      this.isLoading = false;
      this.isInitialLoad = false;
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_orders'),
        life: 3000
      });
    }
  });
}


  private updateLastLazyLoadEvent(event: LazyLoadEvent) {
    persistTablePageSizeFromLazyEvent(TablePageSizeKeys.orders, this.rowsPerPageOptions, event, {
      pageSize: this.pageSize,
      rows: this.rows,
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

    // Store sorting for future reloads
    this.globalFilter = this.lastLazyLoadEvent.globalFilter as string;
  }

  private updateLastProductsLazyLoadEvent(event: LazyLoadEvent) {
    this.lastProductsLazyLoadEvent = {
      first: event.first ?? this.lastProductsLazyLoadEvent.first,
      rows: event.rows ?? this.lastProductsLazyLoadEvent.rows,
      sortField: event.sortField ?? this.lastProductsLazyLoadEvent.sortField,
      sortOrder: event.sortOrder ?? this.lastProductsLazyLoadEvent.sortOrder,
      globalFilter: event.globalFilter ?? this.lastProductsLazyLoadEvent.globalFilter,
      filters: event.filters ?? this.lastProductsLazyLoadEvent.filters
    };
  }

  private updateProductsFilter(field: string, value: any): void {
    const currentFilters = { ...(this.lastProductsLazyLoadEvent.filters || {}) };

    if (value === undefined || value === null || value === '') {
      delete currentFilters[field];
    } else {
      currentFilters[field] = { value };
    }

    this.lastProductsLazyLoadEvent = {
      ...this.lastProductsLazyLoadEvent,
      first: 0,
      filters: currentFilters
    };
  }

  initializePaymentMethods(): void {
    this.paymentMethods = [
      { label: 'Cash', value: 'Cash' },
      { label: 'Card', value: 'Card' },
      { label: 'Check', value: 'Check' },
      { label: 'Transfer', value: 'Transfer' },
      { label: 'BOE', value: 'BOE' }
    ];
  }
  private initializeTranslations() {
    this.translateService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang); // Update language
    });

    this.translate
      .getTranslation(this.translateService.getPreferredLanguage())
      .subscribe((translations) => {
        this.discountTypeOptions = [
          { label: translations['amount'], value: 'Amount' },
          { label: translations['percentage'], value: 'Percentage' }
        ];
        this.events = [
          {
            status: 'Ordered',
            date: 'test',
            icon: 'pi pi-shopping-cart', // 🛒 order placed
            color: '#9C27B0',
            image: 'game-controller.jpg',
            button: translations['process_order_button'],
            buttonDescription: translations['generate_quote'],
          },
          {
            status: 'Canceled',
            date: 'test',
            icon: 'pi pi-times-circle', // ❌ order canceled
            color: '#FF5722'
          },
          {
            status: 'Processing',
            date: 'test',
            icon: 'pi pi-cog', // ⚙️ in progress
            color: '#673AB7',
            button: translations['deliver_order_button'],
            buttonDescription: translations['generate_purchase_order']
          },
          {
            status: 'Delivered',
            date: 'test',
            icon: 'pi pi-truck', // 🚚 delivered
            color: '#2196F3',
            button: translations['complete_order_button'],
            buttonDescription: translations['generate_delivery_order']
          },
          {
            status: 'Completed',
            date: 'test',
            icon: 'pi pi-check-circle', // ✅ done
            color: '#4CAF50',
            buttonDescription: translations['generate_invoice']
          },
          {
            status: 'Return_Pending',
            date: 'test',
            icon: 'pi pi-clock', // ⏳ waiting for return
            color: '#FFC107',
          },
          {
            status: 'Partial_Return',
            date: 'test',
            icon: 'pi pi-undo', // 🔄 partially returned
            color: '#FF9800',
            buttonDescription: translations['generate_return_order']
          },
          {
            status: 'Returned',
            date: 'test',
            icon: 'pi pi-undo', // 🔁 fully returned
            color: '#607D8B',
            buttonDescription: translations['generate_return_order']
          },
        ];


        this.TaxEnabledOptions = [
          { label: translations['enabled'], value: true },
          { label: translations['disabled'], value: false },
        ];
      });
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
    this.canReadBankAccounts = this.isAdmin;
  }

  private initializeTableColumns() {
    // Columns used for export only (table headers are defined in OrdersTable)
    // Desired export columns: reference, total amount, items count, customer, order date
    this.cols = [
      { field: 'reference', header: this.translateService.instant('order_reference') },
      { field: 'totalAmount', header: this.translateService.instant('order_total_amount') },
      { field: 'itemsCount', header: this.translateService.instant('order_items') },
      { field: 'Customer', header: this.translateService.instant('order_customer') },
      { field: 'orderDate', header: this.translateService.instant('order_date') },
    ];
  }

  showEventButton(event: any): boolean {
    const statusMatches = event.status === this.order.orderStatus;
    const hasButton = !!event.button;
    const isDelivered = event.status === 'Delivered';
    const isPaid = this.order.paymentStatus === 'PAID';

    if (!hasButton || !statusMatches) return false;
    if (isDelivered && !isPaid) return false;
    return true;
  }

  private initializeStatuses() {
    // Backend enum: Ordered, Processing, Delivered, Completed, Canceled, Return_Pending, Returned, Partial_Return
    this.statuses = [
      { label: 'Ordered', value: 'Ordered' },
      { label: 'Processing', value: 'Processing' },
      { label: 'Delivered', value: 'Delivered' },
      { label: 'Completed', value: 'Completed' },
      { label: 'Canceled', value: 'Canceled' },
      { label: 'Return_Pending', value: 'Return_Pending' },
      { label: 'Returned', value: 'Returned' },
      { label: 'Partial_Return', value: 'Partial_Return' },
    ];

    this.paymentStatuses = [
      { label: 'Paid', value: 'PAID' },
      { label: 'Partially_Paid', value: 'PARTIALLY_PAID' },
      { label: 'Unpaid', value: 'UNPAID' },
      { label: 'Pending', value: 'PENDING' },
      { label: 'Failed', value: 'FAILED' },
      { label: 'Refunded', value: 'REFUNDED' },
    ];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('order' in changes) {
      this.initializePickList();
    }
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

    this.orders.forEach(order => {
      if (this.hasReturns(order)) {
        this.loadOrderReturns(order);
      }
    });
  }

  disableDoubleClick(items: NodeListOf<Element>) {
    items.forEach(item => {
      item.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
  }


  async onPaymentAmountChange(): Promise<void> {
    // Recalculate credit usage when payment amount changes (if not using explicit credit)
    if (!this.useCredit && this.creditInfo && this.showPaymentSection) {
      const orderTotal = this.getTotalWithoutCredit();
      const availableCredit = this.creditInfo.availableCredit || 0;
      this.creditAmountUsed = Math.min(orderTotal, availableCredit);
    } else if (this.useCredit) {
      // If using credit, adjust payment amount
      this.payment.amount = this.getRemainingAfterCredit();
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
      await this.loadCreditInfo();
    }
  }

  async loadCreditInfo() {
    // CUSTOMER_CREDITS is PRO+. This fires on every customer selection while composing an order,
    // so on STARTER it produced a 403 per order.
    await this.licenseCapabilitiesService.ensureLoaded();
    if (!this.licenseCapabilitiesService.isFeatureEnabled('CUSTOMER_CREDITS')) {
      this.creditInfo = null;
      this.creditAmountUsed = 0;
      return;
    }
    if (!this.order.customer?.customerId) {
      this.creditInfo = null;
      this.creditAmountUsed = 0;
      this.customerPricing = null;
      // Update prices for existing products when customer is cleared
      this.updatePricesForAllProducts();
      return;
    }

    try {
      this.creditService.loadToken();
      const info$ = await this.creditService.getCreditInfo(this.order.customer.customerId);
      const info = await firstValueFrom(info$);
      this.creditInfo = info;

      // Update component properties with new fields
      // Sanitize values to handle invalid/unlimited values
      this.outstandingBalance = this.sanitizeValue(info.outstandingBalance);
      this.overdueBalance = this.sanitizeValue(info.overdueBalance);
      this.netBalance = this.sanitizeValue(info.netBalance);
      this.availableCreditLimit = this.sanitizeValue(info.availableCreditLimit);
      
      // Store original availableCreditLimit for unlimited check
      this.creditInfo.availableCreditLimit = info.availableCreditLimit;
      
      // Check credit limit for order creation
      if (this.order.orderId === undefined) { // New order
        this.checkCreditLimit();
      }
    } catch (error: any) {
      // Credit account might not exist, that's okay
      this.outstandingBalance = 0;
      this.overdueBalance = 0;
      this.netBalance = 0;
      this.availableCreditLimit = 0;
      this.creditInfo = null;
      this.creditAmountUsed = 0;
    }

    // Load customer pricing data using new API
    await this.loadCustomerPricingData();
  }

  async loadCustomerPricingData() {
    if (!this.order.customer?.customerId) {
      this.customerPricing = null;
      return;
    }

    try {
      this.orderService.loadToken();
      const pricing$ = this.orderService.getCustomerPrices(this.order.customer.customerId, undefined, 1);
      const pricingData = await firstValueFrom(pricing$);
      
      this.customerPricing = pricingData;
      console.log('Loaded customer pricing data:', pricingData);
      
      // Show notification if customer has special pricing
      if (pricingData.priceListName) {
        const translatedPriceListName = this.translatePriceListName(pricingData.priceListName);
        const message = (this.translate.instant('customer_pricing_loaded') || 'Customer pricing loaded: {priceList}').replace('{priceList}', translatedPriceListName);
        this.messageService.add({
          severity: 'info',
          summary: this.translate.instant('info'),
          detail: message,
          life: 3000
        });
      }

      // Update prices for all products in the order
      this.updatePricesForAllProducts();
    } catch (error: any) {
      console.error('Error loading customer pricing data:', error);
      this.customerPricing = null;
      // Don't show error to user, just fallback to standard prices
      if (error.status !== 404) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('error_loading_customer_pricing'),
          life: 3000
        });
      }
    }
  }

  /**
   * Get price and price source for a specific product and quantity from customer pricing API
   * Returns an object with price and priceSource, or null if not available
   */
  async getProductPriceForQuantity(productId: number, quantity: number): Promise<{ price: number; priceSource: string } | null> {
    if (!this.order.customer?.customerId) {
      return null;
    }

    try {
      this.orderService.loadToken();
      const pricing$ = this.orderService.getCustomerPrices(
        this.order.customer.customerId,
        [productId],
        quantity
      );
      const pricingData = await firstValueFrom(pricing$);
      
      if (pricingData.prices && pricingData.prices[productId]) {
        const price = pricingData.prices[productId];
        const priceSource = pricingData.priceSources?.[productId] || 'DEFAULT';
        return { price, priceSource };
      }
    } catch (error: any) {
      console.error('Error fetching product price for quantity:', error);
    }
    
    return null;
  }

  /**
   * Load price override configuration from app settings
   */
  async loadPriceOverrideConfig() {
    try {
      const config$ = await this.configService.getConfiguration('pricing.allow.custom.override');
      const config = await firstValueFrom(config$);
      this.priceOverrideAllowed = config?.value === 'true' || config?.value === true;
      console.log('Price override allowed:', this.priceOverrideAllowed);
    } catch (error: any) {
      console.warn('Could not load price override configuration, defaulting to true:', error);
      this.priceOverrideAllowed = true; // Default to true if config not found
    }
  }

  /** Opt-in per tenant: expose the portion selector on sale lines (butchery / divisible goods). */
  async loadPortionSelectionConfig() {
    try {
      const config$ = await this.configService.getConfiguration('sales.portion.selection.enabled');
      const config = await firstValueFrom(config$);
      this.portionSelectionEnabled = config?.value === 'true' || config?.value === true;
    } catch {
      this.portionSelectionEnabled = false;
    }
  }

  /** Portion fraction for a line (defaults to whole = 1). */
  getLinePortionFraction(product: any): number {
    const v = Number(product?.['orderItemPortionFraction']);
    return isNaN(v) || v <= 0 ? 1 : v;
  }

  setLinePortionFraction(product: any, fraction: number): void {
    product['orderItemPortionFraction'] = fraction;
  }

  async loadSalesStockConfig() {
    try {
      const config$ = await this.configService.getConfiguration('sales.stock.include.approved.writeoff.quantity');
      const config = await firstValueFrom(config$);
      this.salesStockIncludesApprovedWriteoffQty = config?.value === 'true' || config?.value === true;
    } catch (e) {
      console.warn('Could not load sales/write-off stock configuration, defaulting to net sellable qty', e);
      this.salesStockIncludesApprovedWriteoffQty = false;
    }
  }

  async loadSalesStockSoftReservationConfig() {
    try {
      const config$ = await this.configService.getConfiguration('sales.stock.soft.reservation.enabled');
      const config = await firstValueFrom(config$);
      this.salesStockSoftReservationEnabled = config?.value === 'true' || config?.value === true;
    } catch (e) {
      console.warn('Could not load soft reservation configuration, defaulting to off', e);
      this.salesStockSoftReservationEnabled = false;
    }
  }

  private newReservationContextId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'ctx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
  }

  private clearLocalCheckoutReservationState(): void {
    if (this.reservationSyncTimer) {
      clearTimeout(this.reservationSyncTimer);
      this.reservationSyncTimer = null;
    }
    this.orderCheckoutReservationContextId = null;
  }

  private scheduleSyncCheckoutReservations(): void {
    if (!this.salesStockSoftReservationEnabled || this.order?.orderId || !this.orderCheckoutReservationContextId) {
      return;
    }
    if (this.reservationSyncTimer) {
      clearTimeout(this.reservationSyncTimer);
    }
    this.reservationSyncTimer = setTimeout(() => {
      this.reservationSyncTimer = null;
      void this.syncCheckoutReservationsNow();
    }, 450);
  }

  private buildCheckoutReservationLines(): { productId: number; quantity: number }[] {
    return this.targetProducts
      .filter(p => this.isProduct(p) && p.productId != null && (p.orderItemQuantity ?? 0) > 0)
      .map(p => ({
        productId: p.productId as number,
        quantity: QuantityScale.isFractional(p)
          ? QuantityScale.toStorageQuantity(p, p.orderItemQuantity as number)
          : (p.orderItemQuantity as number),
      }));
  }

  private async syncCheckoutReservationsNow(): Promise<void> {
    if (!this.salesStockSoftReservationEnabled || this.order?.orderId || !this.orderCheckoutReservationContextId) {
      return;
    }
    const lines = this.buildCheckoutReservationLines();
    try {
      await this.stockReservationService.syncCheckoutContext(this.orderCheckoutReservationContextId, lines);
    } catch (e: any) {
      console.warn('Checkout stock reservation sync failed', e);
      const status = e?.status;
      const msg = (e?.error?.message || e?.message || '').toString();
      if (status === 409 || /reservation|insufficient stock/i.test(msg)) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: msg || this.translate.instant('orders_soft_reservation_sync_failed'),
          life: 6000,
        });
      }
    }
  }

  /** Ensures the server has the latest draft lines before POST /orders (throws on API error). */
  private async flushCheckoutReservationsBeforeSave(): Promise<void> {
    if (!this.salesStockSoftReservationEnabled || this.order?.orderId || !this.orderCheckoutReservationContextId) {
      return;
    }
    if (this.reservationSyncTimer) {
      clearTimeout(this.reservationSyncTimer);
      this.reservationSyncTimer = null;
    }
    const lines = this.buildCheckoutReservationLines();
    await this.stockReservationService.syncCheckoutContext(this.orderCheckoutReservationContextId, lines);
  }

  /**
   * Get the effective price for a product
   * Priority: Custom Price (if override allowed) > Customer Pricing API > Default Selling Price
   */
  getEffectivePrice(product: Product, quantity: number = 1): number {
    // 1. Check if custom price was entered (and overrides are allowed)
    if (this.priceOverrideAllowed && product['orderItemPricePerUnitManual'] && product.orderItemPricePerUnit) {
      return product.orderItemPricePerUnit;
    }
    
    // 2. Check if customer pricing is available
    if (this.customerPricing?.prices && product.productId) {
      const customerPrice = this.customerPricing.prices[product.productId];
      if (customerPrice !== undefined && customerPrice !== null) {
        return customerPrice;
      }
    }
    
    // 3. Fallback to product selling price
    return product.sellingPrice || 0;
  }

  /**
   * Get price source for a product
   */
  getPriceSource(product: Product): string {
    if (!product.productId) {
      return 'DEFAULT';
    }

    // Check if custom price was entered
    if (this.priceOverrideAllowed && product['orderItemPricePerUnitManual']) {
      return 'OVERRIDE';
    }

    // Check customer pricing source
    if (this.customerPricing?.priceSources) {
      return this.customerPricing.priceSources[product.productId] || 'DEFAULT';
    }

    return 'DEFAULT';
  }

  /**
   * Translate price list name if it matches known profiles (WHOLESALE, RETAIL)
   * Otherwise return the name as-is
   */
  translatePriceListName(priceListName: string): string {
    if (!priceListName) return priceListName;
    
    const upperName = priceListName.toUpperCase();
    if (upperName === 'WHOLESALE') {
      return this.translate.instant('price_list_wholesale') || priceListName;
    } else if (upperName === 'RETAIL') {
      return this.translate.instant('price_list_retail') || priceListName;
    }
    
    // Return as-is if no translation found
    return priceListName;
  }

  /**
   * Get price source label for display
   */
  getPriceSourceLabel(source: string): string {
    const labels: { [key: string]: string } = {
      'OVERRIDE': this.translate.instant('special_price'),
      'PRICE_LIST': this.customerPricing?.priceListName 
        ? (this.translate.instant('price_list_label') || 'Price List: {name}').replace('{name}', this.translatePriceListName(this.customerPricing.priceListName))
        : (this.translate.instant('price_list_label') || 'Price List').replace(': {name}', ''),
      'RETAIL_LIST': this.translate.instant('retail_price'),
      'DEFAULT': this.translate.instant('standard_price')
    };
    return labels[source] || labels['DEFAULT'];
  }

  /**
   * Get price source severity for badge styling
   */
  getPriceSourceSeverity(source: string): string {
    const severities: { [key: string]: string } = {
      'OVERRIDE': 'warning',
      'PRICE_LIST': 'info',
      'RETAIL_LIST': 'success',
      'DEFAULT': 'secondary'
    };
    return severities[source] || severities['DEFAULT'];
  }

  /**
   * Update prices for all products in the order based on current customer pricing
   */
  updatePricesForAllProducts() {
    this.targetProducts.forEach((product) => {
      // Only update if price wasn't manually overridden
      if (!product['orderItemPricePerUnitManual']) {
        const quantity = product.orderItemQuantity || this.defaultLineQuantity(product);
        const effectivePrice = this.getEffectivePrice(product, quantity);
        product.orderItemPricePerUnit = effectivePrice;
      }
    });
    this.calculateTotalAmount();
    this.cdr.detectChanges();
  }

  // ⚠️ NEW: Credit selection methods
  onCreditSelectionChange(): void {
    if (this.useCredit) {
      // Auto-calculate credit amount if not set
      if (this.creditAmountToUse === null) {
        this.creditAmountToUse = this.getMaxCreditToUse();
      }
      // Update payment amount
      this.payment.amount = this.getRemainingAfterCredit();
    } else {
      // Reset credit amount
      this.creditAmountToUse = null;
      this.creditAmountUsed = 0;
      // Reset payment amount to full amount
      this.payment.amount = this.getTotalWithoutCredit();
    }
  }

  onCreditAmountChange(): void {
    if (this.useCredit && this.creditAmountToUse !== null) {
      // Validate credit amount
      const maxCredit = this.getMaxCreditToUse();
      if (this.creditAmountToUse > maxCredit) {
        this.creditAmountToUse = maxCredit;
      }
      // Update payment amount
      this.payment.amount = this.getRemainingAfterCredit();
    }
  }

  getMaxCreditToUse(): number {
    if (!this.creditInfo || !this.creditInfo.availableCredit) {
      return 0;
    }
    const orderTotal = this.getTotalWithoutCredit();
    return Math.min(this.creditInfo.availableCredit, orderTotal);
  }

  getCreditToUse(): number {
    if (!this.useCredit || !this.creditInfo) {
      return 0;
    }
    if (this.creditAmountToUse !== null && this.creditAmountToUse > 0) {
      return Math.min(this.creditAmountToUse, this.getMaxCreditToUse());
    }
    return this.getMaxCreditToUse();
  }

  getRemainingAfterCredit(): number {
    const orderTotal = this.getTotalWithoutCredit();
    const creditToUse = this.getCreditToUse();
    return Math.max(0, orderTotal - creditToUse);
  }

  // Helper method to sanitize invalid values (returns 0 for invalid, or -1 for unlimited)
  private sanitizeValue(value: any): number {
    // 0 is a valid value
    if (value === 0) {
      return 0;
    }
    
    if (value === undefined || value === null) {
      return 0;
    }
    
    const valueStr = String(value).toUpperCase();
    
    // Check for scientific notation with large exponent (represents unlimited)
    if (valueStr.includes('E+')) {
      const match = valueStr.match(/E\+(\d+)/);
      if (match && parseInt(match[1]) >= 15) {
        return -1; // Use -1 to represent unlimited
      }
    }
    
    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Check if it's 0 after parsing
    if (numValue === 0) {
      return 0;
    }
    
    const absValue = Math.abs(numValue);
    
    // Check for invalid values (Infinity, NaN, or extremely large)
    if (!isFinite(numValue) || isNaN(numValue) || 
        absValue > 1e15 || 
        absValue >= Number.MAX_VALUE * 0.9) {
      return -1; // Use -1 to represent unlimited
    }
    
    return numValue;
  }

  // Check if available credit limit is unlimited
  isUnlimitedCreditLimit(): boolean {
    return this.availableCreditLimit === -1 || 
           (this.creditInfo && this.isInvalidValue(this.creditInfo.availableCreditLimit));
  }

  // Helper method to check if a value is invalid (for unlimited detection)
  private isInvalidValue(value: any): boolean {
    if (value === 0 || value === undefined || value === null) {
      return false;
    }
    
    const valueStr = String(value).toUpperCase();
    if (valueStr.includes('E+')) {
      const match = valueStr.match(/E\+(\d+)/);
      if (match && parseInt(match[1]) >= 15) {
        return true;
      }
    }
    
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (numValue === 0) {
      return false;
    }
    
    const absValue = Math.abs(numValue);
    return !isFinite(numValue) || isNaN(numValue) || 
           absValue > 1e15 || 
           absValue >= Number.MAX_VALUE * 0.9;
  }

  // Credit limit validation
  checkCreditLimit(): void {
    if (!this.creditInfo || this.order.orderId !== undefined) {
      return; // Only check for new orders
    }
    
    const orderTotal = this.calculateTotalAmount();
    
    // If unlimited, no need to check
    if (this.isUnlimitedCreditLimit()) {
      this.creditLimitExceeded = false;
      this.creditLimitError = null;
      return;
    }
    
    const availableLimit = this.availableCreditLimit;
    
    if (availableLimit > 0 && orderTotal > availableLimit) {
      this.creditLimitExceeded = true;
      this.creditLimitError = this.translate.instant('credit_limit_exceeded', {
        available: availableLimit.toFixed(2),
        order: orderTotal.toFixed(2)
      });
    } else {
      this.creditLimitExceeded = false;
      this.creditLimitError = null;
    }
  }

  // Check if order is overdue
  isOrderOverdue(order: Order): boolean {
    if (!order.paymentDueDate || order.paymentStatus === 'PAID') {
      return false;
    }
    const dueDate = new Date(order.paymentDueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  }

  getDaysOverdue(order: Order): number {
    if (!this.isOrderOverdue(order)) {
      return 0;
    }
    const dueDate = new Date(order.paymentDueDate!);
    const today = new Date();
    return Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddOrder = this.permissionService.canCreate(this.Ressource);
    this.canEditOrder = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteOrder = this.permissionService.canDelete(this.Ressource);
    this.canProcessOrder = this.permissionService.canProcess(this.Ressource);
    this.canCancelOrder = this.permissionService.canProcess(this.Ressource);
    this.canAddCustomer = this.permissionService.canCreate('CUSTOMERS');
    this.canAddShop = this.permissionService.canCreate('SHOPS');
    this.canAddSupplier = this.permissionService.canCreate('SUPPLIERS');
    this.canAddWarehouse = this.permissionService.canCreate('WAREHOUSES');
    this.canAddPayment = this.permissionService.canCreate('PAYMENTS');
    this.canAddProduct = this.permissionService.canCreate('PRODUCTS');
    this.canAddCategory = this.permissionService.canCreate('CATEGORIES');
    this.canEditProduct = this.permissionService.canUpdate('PRODUCTS');
    this.canDeleteProduct = this.permissionService.canDelete('PRODUCTS');
    this.canArchiveProduct = this.permissionService.canArchive('PRODUCTS');
    this.canReadProduct = this.permissionService.canRead('PRODUCTS');
  }

  async loadTaxRate() {
    (await this.configService.getConfiguration("tax")).subscribe((response: any) => {
      // Config values arrive as strings; coerce to a number so arithmetic works. Otherwise the
      // TTC formula `1 + this.taxRate` does string concatenation ("1" + "0.2" = "10.2") and the
      // tax amount / total come out wrong.
      this.taxRate = Number(response?.value) || 0;
    });
    try {
      (await this.configService.getConfiguration('tax.calculation.mode')).subscribe({
        next: (cfg: any) => {
          this.taxRulesMode = String(cfg?.value || 'GLOBAL').toUpperCase() === 'RULES';
        },
        error: () => (this.taxRulesMode = false)
      });
    } catch {
      this.taxRulesMode = false;
    }
    try {
      (await this.configService.getConfiguration('pricing.tax.inclusive')).subscribe({
        next: (cfg: any) => {
          this.taxInclusive = String(cfg?.value).toLowerCase() === 'true';
        },
        error: () => (this.taxInclusive = false)
      });
    } catch {
      this.taxInclusive = false;
    }
  }

  /**
   * RULES mode only: keeps the previewed tax rate aligned with backend per-line
   * resolution by fetching the net-weighted effective rate whenever the order
   * lines or customer change. Deduped by signature so change detection passes
   * don't spam the API; stale responses are dropped via sequence guard.
   */
  private maybeRefreshRuleTaxRate(): void {
    if (!this.taxRulesMode || !this.taxEnabled) return;
    const lines = (this.targetProducts || [])
      .filter(p => p?.productId)
      .map(p => ({
        productId: p.productId,
        netAmount: Math.max(0, (p.orderItemQuantity || 0) * (p.orderItemPricePerUnit || 0))
      }));
    if (!lines.length) return;
    const customerId = this.order?.customer?.customerId ?? null;
    const signature = JSON.stringify({ c: customerId, l: lines });
    if (signature === this.taxResolveSignature) return;
    this.taxResolveSignature = signature;
    const seq = ++this.taxResolveSeq;
    this.taxRuleService
      .resolveTaxRates({ documentType: 'SALES', customerId, lines })
      .then(obs =>
        obs.subscribe({
          next: res => {
            if (seq !== this.taxResolveSeq) return;
            if (res && typeof res.effectiveRate === 'number' && res.mode === 'RULES') {
              this.taxRate = res.effectiveRate;
            }
          },
          error: () => {
            /* keep current rate; retry on next change */
            this.taxResolveSignature = '';
          }
        })
      );
  }

  toggleRow(orderId: number): void {
    this.expandedRows[orderId.toString()] = !this.isRowExpanded(orderId.toString());
    const order = this.orders.find(o => o.orderId === orderId);
    if (order && this.hasReturns(order)) {
      this.loadOrderReturns(order);
    }
  }

  isRowExpanded(orderID: string): boolean {
    return this.expandedRows[orderID] === true;
  }

  isReturnedStatus(status: string): boolean {
    return status === 'Returned' || status === 'Partial_Return';
  }

  getReturnTooltip(status: string): string {
    switch (status) {
      case 'Returned': return 'fully_returned_tooltip';
      case 'Partial_Return': return 'partially_returned_tooltip';
      default: return '';
    }
  }

  hasReturns(order: Order): boolean {
    return order.orderStatus === 'Returned' || order.orderStatus === 'Partial_Return';
  }

  hasRefunds(order: Order): boolean {
    return order.totalRefunded > 0;
  }

  getTotalPayments(order: Order): number {
    return order.totalPaid || 0;
  }
  async loadOrderReturns(order: Order): Promise<void> {
    if (!order.orderId || this.loadingReturns.has(order.orderId) || this.orderReturnsMap.has(order.orderId)) {
      return;
    }

    this.loadingReturns.add(order.orderId);
    try {
      const returns = await this.orderService.getOrdersReturns(order.orderId).toPromise();
      this.orderReturnsMap.set(order.orderId, (returns as OrderReturn[]) || []);
    } catch (error) {
      console.error('Error loading returns:', error);
      this.orderReturnsMap.set(order.orderId, []);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_order_returns'),
        life: 3000
      });
    } finally {
      this.loadingReturns.delete(order.orderId);
    }
  }

  getTotalRefundedAmount(order: Order): number {

    if (!this.orderReturnsMap) return 0;      // <---- FIX 1
    if (!order?.orderId) return 0;

    if (!this.orderReturnsMap.has(order.orderId)) return 0;

    const returns = this.orderReturnsMap.get(order.orderId);

    return returns?.reduce(
      (sum, ret) => sum + (ret.totalRefundableAmount || 0), 0
    ) || 0;
  }

  getNetAmount(order: Order): number {
    return (order.totalAmount || 0) - this.getTotalRefundedAmount(order);
  }

  initializePickList(): void {
    this.sourceProducts = this.getSourceProducts();
    this.targetProducts = this.getTargetProducts();
  }

  getSourceProducts(): Product[] {
    if (this.order && this.order.orderItems && this.order.orderItems.length > 0) {
      return this.products.filter(product =>
        (product.productType === 'SERVICE' || (this.getAvailableQuantity(product) > 0)) &&
        !this.order.orderItems.some(targetProduct => targetProduct.product.productId === product.productId)
      );
    } else {
      return this.products.filter(product => 
        product.productType === 'SERVICE' || 
        (this.getAvailableQuantity(product) > 0)
      );
    }
  }

  getTargetProducts(): Product[] {
    let targetProducts: Product[] = [];
    if (this.order && this.order.orderItems && this.order.orderItems.length > 0) {
      this.order.orderItems.forEach(element => {
        targetProducts.push(element.product);
      });
      return targetProducts;
    } else {
      return [];
    }
  }


  openCustomerDialog() {
    if (!this.canAddCustomer) return;
    this.customer = {};
    this.customerDialog = true;
  }

  async openShopDialog() {
    if (!this.canAddShop) return;
    await this.loadBankAccounts();
    this.shop = {};
    this.shopDialogConfig = {
      visible: true,
      mode: 'create',
      shop: this.shop,
    };
    this.submitted = false;
  }

  onShopDialogConfigChange(config: ShopFormDialogConfig) {
    this.shopDialogConfig = config;
  }

  onShopSave(dialogData: ShopFormDialogData) {
    this.shop = dialogData.shop;
    this.saveShop();
  }

  onShopCancel() {
    this.shopDialogConfig = { ...this.shopDialogConfig, visible: false };
    this.shop = {};
    this.submitted = false;
  }

  openWarehouseDialog(): void {
    if (!this.canAddWarehouse) return;
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: 'Warehouse quick add is not available in this form yet.',
      life: 3000,
    });
  }

  openInvoiceDialog() {
    this.invoiceDialog = true;
  }

  hideInvoiceDialog() {
    this.invoiceDialog = false;
  }

  deleteSelectedOrders() {
    if (!this.canDeleteOrder) return;
    this.deleteOrdersDialog = true;
  }

  private refreshOrderDialogDocumentChainSteps(): void {
    if (!this.salesDocumentChainMode || !this.order?.orderId) {
      this.orderDialogDocumentChainSteps = [];
      this.orderDialogDocumentChainActiveIndex = 0;
      return;
    }
    const L = (key: string) => this.translate.instant(key);
    this.orderDialogDocumentChainSteps = [
      { label: L('doc_chain_step_sales_ordered') },
      { label: L('doc_chain_step_fulfillment') },
      { label: L('doc_chain_step_shipment') },
      { label: L('doc_chain_step_closure') },
    ];
    this.orderDialogDocumentChainActiveIndex = this.orderStatusToDocumentChainStepIndex(this.order.orderStatus);
  }

  private orderStatusToDocumentChainStepIndex(status?: string): number {
    switch (status) {
      case 'Ordered': return 0;
      case 'Processing': return 1;
      case 'Delivered': return 2;
      case 'Completed': return 3;
      default: return 0;
    }
  }

  /** Map API discount type strings to form selectButton values */
  private normalizeDiscountType(raw: unknown): 'Amount' | 'Percentage' {
    const s = String(raw ?? '').trim().toLowerCase();
    if (s === 'percentage' || s === 'percent') {
      return 'Percentage';
    }
    return 'Amount';
  }

  /**
   * Summary panel binds tax to component fields (`taxEnabled`, `taxRate`), not `order.taxEnabled`.
   * Sync those from the loaded order so edit matches persisted values.
   */
  private syncOrderEditFormState(o: Order): void {
    this.taxEnabled = !!o.taxEnabled;
    const savedRate = o.taxRateUsed;
    if (savedRate != null && savedRate !== undefined && !Number.isNaN(Number(savedRate))) {
      this.taxRate = Number(savedRate);
    }
    this.discountType = this.normalizeDiscountType(o.discountType);
    if (o.discount == null || Number.isNaN(Number(o.discount))) {
      o.discount = 0;
    }
    if (o.transportAmount == null || Number.isNaN(Number(o.transportAmount))) {
      o.transportAmount = 0;
    }
    if (o.additionalChargesAmount == null || Number.isNaN(Number(o.additionalChargesAmount))) {
      o.additionalChargesAmount = 0;
    }
  }

  /**
   * p-dropdown matches by reference; API order embeds must match objects in options arrays.
   */
  private alignOrderSelectionsWithLoadedLists(): void {
    const o = this.order;
    if (!o?.orderId) {
      return;
    }
    const cid = o.customer?.customerId;
    if (cid != null && Array.isArray(this.customers) && this.customers.length > 0) {
      const match = this.customers.find((c) => c.customerId === cid);
      if (match) {
        o.customer = match;
      }
    }
    const sid = o.shop?.shopId;
    if (sid != null && Array.isArray(this.shops) && this.shops.length > 0) {
      const match = this.shops.find((s) => s.shopId === sid);
      if (match) {
        o.shop = match;
      }
    }
    if (this.isAdmin && Array.isArray(this.warehouses) && this.warehouses.length > 0) {
      let wid: number | undefined;
      const fromSelection = (this.selectedOrderWarehouse as any)?.warehouseId;
      const fromProduct = (o.orderItems?.[0]?.product as any)?.warehouse?.warehouseId;
      if (fromSelection != null) {
        wid = Number(fromSelection);
      } else if (fromProduct != null) {
        wid = Number(fromProduct);
      }
      if (wid != null && !Number.isNaN(wid)) {
        const wmatch = this.warehouses.find((w) => Number(w.warehouseId) === wid);
        if (wmatch) {
          this.selectedOrderWarehouse = wmatch;
        }
      }
    }
  }

  async editOrder(order: Order) {
    this.scanning = false;
    if (!this.canEditOrder) return;
    this.clearLocalCheckoutReservationState();
    this.order = { ...order };
    this.syncOrderEditFormState(this.order);
    if (this.isAdmin) {
      const firstWarehouse = this.order.orderItems?.[0]?.product?.warehouse || null;
      this.selectedOrderWarehouse = firstWarehouse;
    }
    this.alignOrderSelectionsWithLoadedLists();
    this.onGetAllCustomers(),
    this.onGetAllShops(),
    console.log(this.discountType);
    this.orderItems = this.order.orderItems.map(item => {
      const displayQty = item.displayQuantity ?? QuantityScale.toDisplayQuantity(item.product, item.quantity ?? 0);
      return {
        orderItemId: item.orderItemId,
        product: {
          ...item.product,
          orderItemQuantity: displayQty,
          orderItemPricePerUnit: item.pricePerUnit,
          orderItemPricePerUnitManual: true,
        },
        quantity: item.quantity,
        displayQuantity: displayQty,
        pricePerUnit: item.pricePerUnit,
      };
    });
    // Mutate shared product refs on order.line items before pick list (getTargetProducts uses these refs)
    this.order.orderItems.forEach((item) => {
      const displayQty = item.displayQuantity ?? QuantityScale.toDisplayQuantity(item.product, item.quantity ?? 0);
      item.product.orderItemQuantity = displayQty;
      item.product.orderItemPricePerUnit = item.pricePerUnit;
      item.product['orderItemPricePerUnitManual'] = true;
      item.product['orderItemPortionFraction'] = item.portionFraction ?? 1;
      // Restore previously-selected sale-line options so they round-trip on edit.
      const savedOptionIds = (item.selectedOptions || [])
        .map(o => o.lineOptionId)
        .filter((id): id is number => id != null);
      if (savedOptionIds.length) {
        (item.product as any)['__pendingSelectedOptionIds'] = savedOptionIds;
      }
      void this.loadOptionSetsForLine(item.product, true);
    });
    this.showPaymentSection = false;
    await this.onGetProductsCategories();
    this.getSourceProducts();
    this.getTargetProducts();
    this.initializePickList();
    this.initializePaymentMethods();
    await this.onGetQuickProducts();
    this.alignOrderSelectionsWithLoadedLists();
    this.calculateTotalAmount();
    this.orderDialog = true;
    this.refreshOrderDialogDocumentChainSteps();

    console.log(this.order);
    this.cdr.markForCheck();
  }


  // Update the remaining quantity after return
  updateRemainingQuantity(item: any) {
    item.remainingQuantity = this.getOrderItemRemainingQty(item) - (item.displayReturnQuantity || 0);
  }

  updateReturnedQuantity(item: any) {
    const selectedItem = this.selectedItems.find(si => si.orderItemId === item.orderItemId);
    if (selectedItem) {
      selectedItem.displayReturnQuantity = item.displayReturnQuantity;
      if (item.product && item.displayReturnQuantity != null) {
        selectedItem.returnedQuantity = QuantityScale.isFractional(item.product)
          ? QuantityScale.toStorageQuantity(item.product, item.displayReturnQuantity)
          : Math.round(item.displayReturnQuantity);
      }
    }
    this.updateRemainingQuantity(item);
  }

  deleteOrder(order: Order) {
    if (!this.canDeleteOrder) return;
    this.deleteOrderDialog = true;
    this.order = { ...order };
  }

  async confirmDeleteSelected(force: boolean = false) {
    this.deleteOrdersDialog = false;
    await Promise.all(this.selectedOrders.map(selectedOrder => this.onDeleteOrder(selectedOrder.orderId, force)));
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('successful'),
      detail: this.translate.instant('orders_deleted'),
      life: 3000
    });
    this.selectedOrders = [];
  }

  async confirmDelete(orderId?: number, force: boolean = false) {
    this.deleteOrderDialog = false;
    const id = orderId ?? this.order?.orderId;
    await this.onDeleteOrder(id, force);
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('successful'),
      detail: this.translate.instant('order_deleted'),
      life: 3000
    });
    this.order = {};
  }

  hideDialog() {
    const ctx = this.orderCheckoutReservationContextId;
    const wasNewDraft = !this.order?.orderId;
    const releaseOnServer = this.salesStockSoftReservationEnabled && wasNewDraft && !!ctx;

    this.orderDialog = false;
    this.showPaymentSection = false;
    this.payment = {};
    this.submitted = false;

    if (releaseOnServer && ctx) {
      void this.stockReservationService
        .syncCheckoutContext(ctx, [])
        .catch((e) => console.warn('Could not release checkout stock reservations', e))
        .finally(() => this.clearLocalCheckoutReservationState());
    } else {
      this.clearLocalCheckoutReservationState();
    }
  }

  hideCustomerDialog() {
    this.customerDialog = false;
  }

  hideOrderReturnDialog() {
    this.orderReturnDialog = false;
  }

  /** When NadiPilot sends the user here with ?newOrder=1, open the prepared new-order dialog. */
  private applyCreateOrderFromQuery(qp: ParamMap): void {
    if (!qp || !qp.get('newOrder')) {
      return;
    }
    const customerName = qp.get('customer');
    // Consume the trigger straight away (replacing history, not adding to it) so a refresh or a
    // Back into this page doesn't silently reopen the dialog.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { newOrder: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    // Defer so permissions/data finish loading before opening the dialog.
    setTimeout(() => {
      try {
        void this.openNew();
        if (customerName) {
          this.prefillOrderCustomer(customerName);
        }
      } catch {
        // best-effort; the user is already on the orders screen
      }
    }, 600);
  }

  /** Best-effort: match a customer by name from NadiPilot and preselect it once the list has loaded. */
  private prefillOrderCustomer(name: string, attempt: number = 0): void {
    const wanted = (name || '').trim().toLowerCase();
    if (!wanted) {
      return;
    }
    const list = this.customers || [];
    if (!list.length) {
      if (attempt < 15) {
        setTimeout(() => this.prefillOrderCustomer(name, attempt + 1), 200);
      }
      return;
    }
    const match = list.find((c: any) => {
      const display = (this.getCustomerDisplayName(c) || '').toLowerCase();
      const company = (c.companyName || '').toLowerCase();
      const full = `${c.firstName || ''} ${c.lastName || ''}`.trim().toLowerCase();
      return display.includes(wanted) || company.includes(wanted) || (full && full.includes(wanted));
    });
    if (match) {
      this.order.customer = match;
      try {
        void this.loadCreditInfo();
      } catch {
        // pricing/credit is best-effort
      }
    }
  }

  async openNew() {
    if (!this.canAddOrder) return;
    this.clearLocalCheckoutReservationState();
    this.order = {};
    this.selectedOrderWarehouse = null;
    this.discountType = "Amount";
    this.order.discount = 0;
    this.order.transportAmount = 0;
    this.order.additionalChargesAmount = 0;
    this.order.taxEnabled = false;
    await this.onGetProductsCategories();
    this.targetProducts = [];
    this.orderItems = [];
    await this.onGetQuickProducts();
    this.submitted = false;
    this.showPaymentSection = false;
    this.payment = new Payment();
    // ⚠️ CRITICAL: Always reset credit selection to false when opening new order
    this.useCredit = false;
    this.creditAmountToUse = null;
    this.creditAmountUsed = 0;
    // ⚠️ CRITICAL: Reset credit limit error states when opening new order
    this.creditLimitExceeded = false;
    this.creditLimitError = null;
    this.creditInfo = null;
    this.loadProducts();
    this.onGetAllCustomers(),
    this.onGetAllShops(),
    this.initializePaymentMethods();
    this.getSourceProducts(),
    this.getTargetProducts(),
    this.initializePickList();
    this.orderCheckoutReservationContextId = this.salesStockSoftReservationEnabled
      ? this.newReservationContextId()
      : null;
    this.orderDialog = true;
    this.scanning = true;
  }


  async saveOrder() {
    this.submitted = true;

    if (this.showPaymentSection) {
      const paymentValid = await this.validatePayment();
      if (!paymentValid) {
        return; // Stop if payment validation fails
      }
    }

    // Existing order validations
    if (this.discountType === 'Percentage' && this.order.discount > 100) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('percentage_discount_exceeds_limit'),
        life: 3000,
      });
      return;
    }

    if (!this.order.customer) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('customer_required'),
        life: 3000,
      });
      return;
    }

    if (this.isAdmin && !this.order.shop) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('shop_required'),
        life: 3000,
      });
      return;
    }
    if (this.isAdmin && !this.selectedOrderWarehouse) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('warehouse_required'),
        life: 3000,
      });
      return;
    }

    if (this.targetProducts.length === 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('products_required'),
        life: 3000,
      });
      return;
    }
    if (this.targetProducts.some((p) => this.isFashionVariantMissing(p))) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('profile_mode_fashion_order_variant_required'),
        life: 4500,
      });
      return;
    }
    if (!this.allLinesOptionsValid()) {
      const bad = this.targetProducts.find(p => !this.lineOptionsValid(p));
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('line_options_required_for_line', { product: bad?.name || '' }),
        life: 4500,
      });
      return;
    }
    if (this.isAdmin) {
      const selectedWarehouseId = this.getSelectedOrderWarehouseId();
      const hasMismatchedWarehouse = this.targetProducts.some(
        p => p.productType !== 'SERVICE' &&
          selectedWarehouseId != null &&
          Number((p.warehouse as any)?.warehouseId) !== Number(selectedWarehouseId)
      );
      if (hasMismatchedWarehouse) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('please_select_products_from_same_warehouse'),
          life: 3500,
        });
        return;
      }
    }

    // Prepare Order Items
    const orderItems: OrderItem[] = this.targetProducts.map((product) =>
      buildOrderItemPayload(
        product,
        product['orderItemQuantity'] ?? this.defaultLineQuantity(product),
        this.getOrderItemPricePerUnitForPayload(product),
        {
          selectedOptions: this.buildSelectedOptionsPayload(product),
          portionFraction: this.getLinePortionFraction(product),
        }
      )
    );

    // ⚠️ REMOVED: Credit limit validation before order creation
    // The backend will now handle this properly when payments are included

    // Build payment object if payment section is shown (only for new orders)
    let paymentsToInclude: Payment[] = [];
    if (!this.order.orderId && this.showPaymentSection) {
      // Check if payment has minimum required fields
      if (this.payment.amount && this.payment.paymentMethod && this.payment.paymentDate) {
        const paymentToInclude = this.buildPaymentForOrderRequest();
        if (paymentToInclude) {
          paymentsToInclude = [paymentToInclude];
          // ⚠️ DEBUG: Log payment object to verify useCredit is explicitly set
          console.log('Including payment in order creation:', {
            ...paymentToInclude,
            useCredit: (paymentToInclude as any).useCredit,
            creditAmountToUse: (paymentToInclude as any).creditAmountToUse,
            useCreditExplicitlySet: (paymentToInclude as any).useCredit !== undefined
          });
        }
      } else {
        console.warn('Payment section shown but payment data incomplete:', this.payment);
      }
    }

    // Create New Order Object
    const newOrder: Order = {
      ...this.order,
      orderItems,
      taxEnabled: this.taxEnabled,
      discountType: this.discountType,
      discount: this.order.discount,
    };

    // Include payments in order request (only for new orders)
    // This allows backend to skip credit limit check if order will be paid immediately
    if (paymentsToInclude.length > 0) {
      newOrder.payments = paymentsToInclude;
      // ⚠️ DEBUG: Log full order payload to verify useCredit is explicitly false
      console.log('Order with payments (full payload):', JSON.stringify(newOrder, null, 2));
      console.log('Payment useCredit values:', paymentsToInclude.map((p: any) => ({
        paymentMethod: p.paymentMethod,
        useCredit: p.useCredit,
        creditAmountToUse: p.creditAmountToUse,
        useCreditExplicitlySet: p.useCredit !== undefined
      })));
    }

    try {
      let savedOrder: Order;

      if (!newOrder.orderId && this.salesStockSoftReservationEnabled && this.orderCheckoutReservationContextId) {
        await this.flushCheckoutReservationsBeforeSave();
      }

      if (newOrder.orderId) {
        savedOrder = await this.updateOrder(newOrder.orderId, newOrder);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('order_updated'),
          life: 3000,
        });
      } else {
        // Create new order (payments will be processed automatically by backend if included)
        savedOrder = await this.addOrder(
          newOrder,
          this.salesStockSoftReservationEnabled ? this.orderCheckoutReservationContextId : null
        );
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('order_added'),
          life: 3000,
        });

        // ⚠️ IMPORTANT: Only process payment separately if it wasn't included in order creation
        // This is a fallback for cases where payment couldn't be included
        if (this.showPaymentSection && savedOrder && paymentsToInclude.length === 0) {
          console.log('Payment not included in order creation, processing separately:', savedOrder);
          await this.processPayment(savedOrder);
        } else if (paymentsToInclude.length > 0) {
          console.log('Payment was included in order creation, no need to process separately');

          // Refresh the order from backend so we get the persisted payment entity
          if (savedOrder.orderId) {
            try {
              savedOrder = await firstValueFrom(this.orderService.getOrder(savedOrder.orderId));
            } catch (error) {
              console.warn('Could not refresh order after creation:', error);
            }
          }

          // Try to open the receipt dialog using the latest payment on the saved order
          const savedPayments: any[] = (savedOrder as any)?.payments || [];
          if (savedPayments.length > 0) {
            const latestPayment = savedPayments[savedPayments.length - 1];
            try {
              this.showReceiptDialog(savedOrder, latestPayment);
            } catch (err) {
              console.warn('Could not open receipt dialog after order creation:', err);
            }
          }
        }

        // As a final safety net, if a payment section was shown and we still haven't
        // opened the receipt dialog (e.g. backend attached payments differently),
        // fetch payments by orderId and open the dialog with the latest payment.
        if (this.showPaymentSection && savedOrder?.orderId && !this.receiptDialogVisible) {
          try {
            this.paymentService.loadToken();
          } catch {
            // ignore token load issues; the request will fail and be logged below
          }

          this.paymentService.getPaymentsByOrderId(savedOrder.orderId).subscribe({
            next: (response: any) => {
              const payments: any[] = Array.isArray(response) ? response : (response || []);
              if (!payments.length || this.receiptDialogVisible) {
                return;
              }
              const latest = payments[payments.length - 1];
              try {
                this.showReceiptDialog(savedOrder, latest);
              } catch (err) {
                console.warn('Could not open receipt dialog after fetching order payments:', err);
              }
            },
            error: (err: any) => {
              console.warn('Could not fetch payments for newly created order:', err);
            }
          });
        }
      }

      // ⚠️ IMPORTANT: Only cleanup temporary fields AFTER successful save
      // This prevents losing product data if save fails
      newOrder.orderItems.forEach((orderItem) => {
        delete orderItem.product['orderItemQuantity'];
        delete orderItem.product['orderItemPricePerUnit'];
      });

      this.orderDialog = false;
      this.resetForms();

    } catch (error: any) {
      console.error('Error in saveOrder:', error);
      this.showOrderSaveError(error);
    }
  }

  /**
   * Surface an order-save failure with the right severity. Business-rule / validation / permission
   * violations come back as 4xx with a human message (the backend's controls) — show those as a
   * warning the user can act on. Genuine server failures (5xx) or messageless errors show a clean
   * generic error instead of leaking "Internal Server Error".
   */
  private showOrderSaveError(error: any): void {
    const status: number = Number(error?.status ?? error?.error?.status ?? 0);
    // Prefer the backend's structured detail; avoid the noisy HttpErrorResponse.message string.
    const detail: string =
      error?.userFriendlyMessage ||
      error?.error?.message ||
      (typeof error?.error === 'string' ? error.error : '') ||
      '';

    // Unexpected server failure, or nothing meaningful to show → clean generic error.
    if (status >= 500 || status === 0 || !detail) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('order_save_unexpected_error'),
        life: 4000,
      });
      return;
    }

    // The shop's drawer is closed. Only POS may open one on the user's behalf, so instead of a
    // dead-end conflict toast, offer a route to the cash register where somebody at the till can
    // open it with a counted float. Matched on the stable errorCode, never on translated text.
    if (error?.error?.errorCode === 'NO_ACTIVE_CASH_SESSION') {
      this.noCashSessionMessage = detail;
      this.noCashSessionShopId = this.toPositiveNumber(this.order?.shop?.shopId) ?? null;
      this.noCashSessionDialog = true;
      return;
    }

    // 4xx: a control the user can understand and fix → warning with the backend's own message.
    const low = detail.toLowerCase();
    const isStock =
      error?.error?.code === 'insufficient_stock' ||
      error?.error?.error === 'Insufficient Stock' ||
      low.includes('insufficient stock') ||
      low.includes('net available') ||
      low.includes('written off') ||
      low.includes('reservation');
    const summary = isStock
      ? this.translate.instant('insufficient_stock_title')
      : this.translate.instant('warning');

    this.messageService.add({
      severity: 'warn',
      summary,
      detail,
      life: 6000,
    });
  }

  /** Send the user to the shop's cash register so the drawer can be opened, then retry the order. */
  goToCashRegister(): void {
    this.noCashSessionDialog = false;
    const target = this.noCashSessionShopId != null
      ? ['/finance/treasury/cash-registers', this.noCashSessionShopId]
      : ['/finance/treasury/cash-registers'];
    this.router.navigate(target);
  }

  async validatePayment(): Promise<boolean> {
    // ⚠️ IMPORTANT: If using credit, ensure payment amount is set to remaining amount
    if (this.useCredit) {
      const remainingAmount = this.getRemainingAfterCredit();
      this.payment.amount = remainingAmount;
    }

    // Check required fields (paymentMethod and paymentDate are always required)
    if (!this.payment.paymentMethod || !this.payment.paymentDate) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000,
      });
      return false;
    }

    const amount: number | undefined = this.payment.amount;
    const paymentAmount: number = amount !== undefined && amount !== null ? Number(amount) : 0;

    // When using credit that fully covers the amount, payment amount can be 0
    // Otherwise, payment amount must be at least 0.01
    if (!this.useCredit && (isNaN(paymentAmount) || paymentAmount < 0.01)) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('payment_amount_invalid_min'),
        life: 3000,
      });
      return false;
    }

    // When using credit, amount can be 0 if credit covers everything, but must be >= 0
    if (this.useCredit && (isNaN(paymentAmount) || paymentAmount < 0)) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('payment_amount_invalid'),
        life: 3000,
      });
      return false;
    }

    // Validate credit usage if credit is being used
    if (this.creditAmountUsed > 0) {
      if (!this.creditInfo || this.creditInfo.status !== 'ACTIVE') {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('credit_account_not_active'),
          life: 3000,
        });
        return false;
      }

      // Check if available credit is sufficient
      const orderTotal = this.getTotalWithoutCredit();
      if (this.creditAmountUsed > (this.creditInfo.availableCredit || 0)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('insufficient_credit_balance', {
            available: this.creditInfo.availableCredit || 0,
            requested: this.creditAmountUsed
          }),
          life: 3000,
        });
        return false;
      }
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

  /**
   * Build payment object to include in order creation request
   * This allows the backend to skip credit limit check when immediate payment methods cover the full amount
   */
  buildPaymentForOrderRequest(): Payment | null {
    if (!this.payment.amount || !this.payment.paymentMethod || !this.payment.paymentDate) {
      return null;
    }

    // Format payment date - must be YYYY-MM-DD format
    const formattedPaymentDate = this.formatPaymentDate(this.payment.paymentDate);
    if (!formattedPaymentDate) {
      console.error('Invalid payment date:', this.payment.paymentDate);
      return null;
    }

    // Build payment object according to backend specification
    const payment: Payment = {
      // Required fields
      amount: this.payment.amount,
      paymentMethod: this.payment.paymentMethod,
      paymentDate: formattedPaymentDate, // Must be YYYY-MM-DD format
      direction: 'INCOMING', // Required for orders
      
      // Payment status - backend will set based on payment method
      paymentStatus: 'PENDING',
      
      // Optional fields based on payment method
      checkNumber: this.payment.checkNumber || undefined,
      boeNumber: this.payment.boeNumber || undefined,
      checkExpirationDate: this.formatPaymentDate(this.payment.checkExpirationDate),
      boeExpirationDate: this.formatPaymentDate(this.payment.boeExpirationDate),
      
      // Notes
      notes: this.payment.notes || undefined,
    };

    // Bank account (required for Transfer, Check, BOE)
    if (this.payment.bankAccountId) {
      const selectedBankAccount = this.bankAccounts.find(acc => acc.accountId === this.payment.bankAccountId);
      // Include bankAccount with only accountId as per specification
      (payment as any).bankAccount = {
        accountId: selectedBankAccount?.accountId ?? this.payment.bankAccountId
      };
    }

    // ⚠️ CRITICAL: Credit-related fields - ALWAYS explicitly set
    // Credit should ONLY be used when user explicitly checks "Use Credit" option
    if (this.useCredit === true) {
      // User explicitly checked "Use Credit" - calculate credit amount
      const creditToUse = this.getCreditToUse();
      (payment as any).useCredit = true;
      (payment as any).creditAmountToUse = creditToUse > 0 ? creditToUse : null;
    } else {
      // User did NOT check "Use Credit" - explicitly set to false
      // This ensures credit is NEVER automatically applied
      (payment as any).useCredit = false;
      (payment as any).creditAmountToUse = null;
    }

    // DO NOT include these fields (they'll be set by backend):
    // paymentId, order, customer, transactionId, creationDate, createdBy, allocations

    return payment;
  }

  /**
   * Format payment date to YYYY-MM-DD string format
   */
  formatPaymentDate(date: Date | string | null | undefined): string | undefined {
    if (!date) {
      return undefined;
    }

    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return undefined;
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  async processPayment(order: Order): Promise<void> {
    this.isSavingPayment = true;
    this.payment.order = order;
    this.payment.customer = order.customer;
    console.log('Processing payment for order:', order);

    if (!this.payment.order || !this.payment.amount || !this.payment.paymentMethod || !this.payment.paymentDate) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    if (this.payment.amount < 0.01) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('payment_amount_invalid_min')
      });
      this.isSavingPayment = false;
      return;
    }

    if (!(await this.prepareBankPaymentContext())) {
      this.isSavingPayment = false;
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
      this.isSavingPayment = false;
      return;
    }

    if (this.payment.paymentDate) {
      // Ensure `dateOfExpense` is a Date object
      const date =
        typeof this.payment.paymentDate === "string"
          ? new Date(this.payment.paymentDate)
          : this.payment.paymentDate;

      // Format the date into YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
      const day = String(date.getDate()).padStart(2, "0");

      this.payment.paymentDate = `${year}-${month}-${day}`; // Convert to string format
    }

    if (this.payment.checkExpirationDate) {
      // Ensure `dateOfExpense` is a Date object
      const date =
        typeof this.payment.checkExpirationDate === "string"
          ? new Date(this.payment.checkExpirationDate)
          : this.payment.checkExpirationDate;

      // Format the date into YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
      const day = String(date.getDate()).padStart(2, "0");

      this.payment.checkExpirationDate = `${year}-${month}-${day}`; // Convert to string format
    }
    else     if (this.payment.boeExpirationDate) {
      // Ensure `dateOfExpense` is a Date object
      const date =
        typeof this.payment.boeExpirationDate === "string"
          ? new Date(this.payment.boeExpirationDate)
          : this.payment.boeExpirationDate;

      // Format the date into YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
      const day = String(date.getDate()).padStart(2, "0");

      this.payment.boeExpirationDate = `${year}-${month}-${day}`; // Convert to string format
    }

    // ⚠️ NEW: Prepare payment request with explicit credit selection
    const paymentToSend = { ...this.payment };
    
    // Add credit fields if credit is selected
    if (this.useCredit) {
      paymentToSend.useCredit = true;
      paymentToSend.creditAmountToUse = this.getCreditToUse() > 0 ? this.getCreditToUse() : null;
    } else {
      paymentToSend.useCredit = false;
      paymentToSend.creditAmountToUse = null;
    }
    
    // Remove creditAmountUsed from request (backend calculates it)
    delete paymentToSend.creditAmountUsed;

    // Set payment status to PENDING for bank payment methods (Check, BOE, Transfer)
    // These payments require reconciliation before confirmation
    const isBankPayment = this.paymentValidationService.isBankMethod(this.payment.paymentMethod || '');
    if (isBankPayment) {
      paymentToSend.paymentStatus = 'PENDING';
    }

    // Add bankAccount object if bankAccountId is present (REQUIRED for Check, BOE, and Bank Transfer payments)
    if (this.payment.bankAccountId) {
      const selectedBankAccount = this.bankAccounts.find(acc => acc.accountId === this.payment.bankAccountId);
      // Add bankAccount object to paymentToSend (backend expects this)
      (paymentToSend as any).bankAccount = selectedBankAccount || { accountId: this.payment.bankAccountId };
    } else if (this.isBankAccountRequired) {
      // Bank account is required but not provided - validation should have caught this, but double-check
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('bank_account_required_for_method', { method: this.payment.paymentMethod || '' })
      });
      this.isSavingPayment = false;
      return;
    }

    try {
      // Send payment without creditAmountUsed (backend handles it automatically)
      const paymentResponse: any = await this.paymentService.savePayment(paymentToSend).toPromise();
      
      // Read creditAmountUsed from response (backend returns it)
      if (paymentResponse?.creditAmountUsed) {
        this.creditAmountUsed = paymentResponse.creditAmountUsed;
        // Show success message with credit breakdown
        const remainingAmount = (paymentResponse.amount || 0) - (paymentResponse.creditAmountUsed || 0);
        let detailMessage = this.translate.instant('payment_added');
        if (paymentResponse.creditAmountUsed > 0) {
          const creditFormatted = paymentResponse.creditAmountUsed.toFixed(2);
          if (remainingAmount > 0) {
            const remainingFormatted = remainingAmount.toFixed(2);
            detailMessage += `. ${this.translate.instant('credit_used')}: ${creditFormatted} ${this.currency}, ${this.translate.instant('payment_method_amount')}: ${remainingFormatted} ${this.currency}`;
          } else {
            detailMessage += `. ${this.translate.instant('fully_paid_by_credit')}: ${creditFormatted} ${this.currency}`;
          }
        }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
          detail: detailMessage,
          life: 5000,
        });
      } else {
        let detailMessage = this.translate.instant('payment_added');
        // If payment is pending (bank method), inform user about reconciliation workflow
        if (paymentResponse?.paymentStatus === 'PENDING' || isBankPayment) {
          detailMessage += '. ' + this.translate.instant('payment_pending_reconciliation');
        }
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: detailMessage,
          life: isBankPayment ? 5000 : 3000,
        });
      }
      this.showReceiptDialog(order, paymentResponse);

    } catch (error: any) {
      console.error(error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('payment_error') + ': ' + error.message,
        life: 3000,
      });
    } finally {
      this.isSavingPayment = false;
    }
  }

  showReceiptDialog(order: Order, payment: any) {
    this.receiptDialogVisible = true;
    this.receiptData = { order, payment }; // store reference for dialog
    console.log('Receipt data set:', this.receiptData);
  }

  closeReceiptDialog() {
    this.receiptDialogVisible = false;
    this.resetForms();
  }

  generateReceipt() {
    const { order, payment } = this.receiptData;
    if (!payment?.paymentId) {
      return;
    }

    this.loadingReceipt = true;

    this.financialDocService.generateReceiptFromPOS(payment.paymentId).subscribe({
      next: (res: any) => {
        this.receiptDialogVisible = false;

        // Reuse the existing logic to open the PDF
        this.financialDocService.printFinancialDoc(res.number);

        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('receipt_generated'),
          detail: res.number,
        });

        this.resetForms();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('receipt_generation_failed'),
        });
      },
      complete: () => {
        this.loadingReceipt = false;
      }
    });
  }

  generateInvoice(order: Order) {
    this.financialDocService.generateInvoiceFromOrder(order.orderId).subscribe({
      next: (res: any) => {
        // this.invoiceDialogVisible = false;

        // Reuse the existing logic to open the PDF
        this.financialDocService.printFinancialDoc(res.number);

        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('invoice_generated'),
          detail: res.number,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invoice_generation_failed'),
        });
      }
    });
  }

  async resetForms(): Promise<void> {
    this.clearLocalCheckoutReservationState();
    this.order = {};
    this.targetProducts = [];
    this.showPaymentSection = false;
    this.taxEnabled = false;
    this.payment = {
      amount: null,
      paymentMethod: 'Cash',
      paymentDate: new Date(),
      checkNumber: null,
      checkExpirationDate: null,
      boeNumber: null,
      boeExpirationDate: null,
      notes: ''
    };
    // ⚠️ CRITICAL: Always reset credit selection to false
    this.useCredit = false;
    this.creditAmountToUse = null;
    this.creditAmountUsed = 0;
    this.scanning = false;
    this.submitted = false;
    this.loadOrders();
  }

  saveCustomer() {
    if (this.customer.firstName && this.customer.lastName) {
      this.addCustomer(this.customer)
        ? this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('customer_added'),
          life: 3000
        })
        : this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_adding_customer'),
          life: 3000
        });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
      return;
    }
    this.customers = [...this.customers];
    this.customerDialog = false;
    this.customer = {};
  }

  saveShop() {
    this.submitted = true;
    if (this.shop.shopName) {
      this.addShop(this.shop)
        ? this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('shop_added'),
          life: 3000
        })
        : this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_adding_shop'),
          life: 3000
        });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
      return;
    }
    this.shops = [...this.shops];
    this.shopDialogConfig = { ...this.shopDialogConfig, visible: false };
    this.shop = {};
    this.submitted = false;
  }

  // Filter properties
  selectedOrderStatus: string | null = null;
  selectedPaymentStatus: string | null = null;
  selectedCustomer: Customer | null = null;
  selectedShop: Shop | null = null;

  /** Shown when a Cash order is refused because the shop's cash register has no open session. */
  noCashSessionDialog: boolean = false;
  noCashSessionMessage: string = '';
  private noCashSessionShopId: number | null = null;
  orderDateFrom: Date | null = null;
  orderDateTo: Date | null = null;

  onGlobalFilter(event: { globalFilter: string }) {
    this.scanning = false;
    this.globalFilter = event.globalFilter;

    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      globalFilter: this.globalFilter
    };

    this.onLazyLoad(lazyEvent);
  }

  onFilterChange(filterData: {
    orderStatus?: string | null;
    paymentStatus?: string | null;
    customer?: Customer | null;
    shop?: Shop | null;
    orderDateFrom?: Date | null;
    orderDateTo?: Date | null;
  }) {
    this.selectedOrderStatus = filterData.orderStatus ?? null;
    this.selectedPaymentStatus = filterData.paymentStatus ?? null;
    this.selectedCustomer = filterData.customer ?? null;
    this.selectedShop = filterData.shop ?? null;
    this.orderDateFrom = filterData.orderDateFrom ?? null;
    this.orderDateTo = filterData.orderDateTo ?? null;

    // Apply filters immediately when filter values change
    this.applyFilters();
  }

  applyFilters() {
    // Build filters object in the format expected by the service
    // Service expects: { field: { value: ..., matchMode: ... } }
    const filters: any = {};
    
    if (this.selectedOrderStatus) {
      filters.orderStatus = { value: this.selectedOrderStatus, matchMode: 'equals' };
    }
    if (this.selectedPaymentStatus) {
      filters.paymentStatus = { value: this.selectedPaymentStatus, matchMode: 'equals' };
    }
    if (this.selectedCustomer) {
      filters.customerId = { value: this.selectedCustomer.customerId, matchMode: 'equals' };
    }
    if (this.selectedShop) {
      filters.shopName = { value: this.selectedShop.shopName, matchMode: 'equals' };
    }
    // NEW: Support date range filtering with fromDate and toDate
    if (this.orderDateFrom) {
      filters.orderDateFrom = { value: this.orderDateFrom, matchMode: 'equals' };
    }
    if (this.orderDateTo) {
      filters.orderDateTo = { value: this.orderDateTo, matchMode: 'equals' };
    }

    console.log('=== APPLYING FILTERS ===');
    console.log('Selected order status (raw):', this.selectedOrderStatus, typeof this.selectedOrderStatus);
    console.log('Selected payment status (raw):', this.selectedPaymentStatus, typeof this.selectedPaymentStatus);
    console.log('Selected customer:', this.selectedCustomer);
    console.log('Selected shop:', this.selectedShop);
    console.log('Order date from:', this.orderDateFrom);
    console.log('Order date to:', this.orderDateTo);
    console.log('Filters object:', JSON.stringify(filters, null, 2));

    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      filters: filters
    };

    this.updateLastLazyLoadEvent(lazyEvent);
    this.isLoading = true;
    this.loadOrders();
  }

  resetFilters() {
    this.selectedOrderStatus = null;
    this.selectedPaymentStatus = null;
    this.selectedCustomer = null;
    this.selectedShop = null;
    this.orderDateFrom = null;
    this.orderDateTo = null;

    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      filters: {}
    };

    this.onLazyLoad(lazyEvent);
  }

  private applyPendingEditOrderIdFromQuery(qm: ParamMap): void {
    const editId = qm.get('editOrderId');
    const parsed = editId ? Number(editId) : NaN;
    this.pendingEditOrderId = !isNaN(parsed) ? parsed : null;
  }

  private applyOrderStatusFromQueryParam(raw: string | null): void {
    const allowed = OrdersComponent.URL_ORDER_STATUSES as readonly string[];
    this.selectedOrderStatus = raw && allowed.includes(raw) ? raw : null;
  }

  // onFilter(dv: DataView, event: Event) {
  //   dv.filter((event.target as HTMLInputElement).value);
  // }

  clear(table: Table) {
    table.clear();
  }

  onLazyLoadProducts(event: LazyLoadEvent) {
    const extendedEvent: LazyLoadEventExt = {
      ...event,
      globalFilter: this.globalFilter
    };

    this.updateLastProductsLazyLoadEvent(extendedEvent);
    this.loadProducts();
  }



  loadProducts() {
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastProductsLazyLoadEvent;

    const page = first! / rows!;
    const size = rows!;
    const direction = sortOrder === -1 ? 'ASC' : 'DESC';
    const productFilters = filters ? { ...filters } : {};

    console.log('Loading products with parameters:', {
      page,
      size,
      sortField,
      direction,
      globalFilter,
      filters: productFilters
    });

    this.productService.getProductsPaginated(
      page,
      size,
      globalFilter || '',
      sortField!,
      direction,
      productFilters
    ).subscribe({
      next: (res: any) => {
        console.log('Paginated products response:', res);
        // Assign the paginated orders
        const selectedWarehouseId = this.getSelectedOrderWarehouseId();
        let mappedProducts = res.page.content.map((p: any) => ({
          ...p,
          creationDate: p.creationDate ? new Date(p.creationDate) : null,
          archivedDate: p.archivedDate ? new Date(p.archivedDate) : null,
          buyingDate: p.buyingDate ? new Date(p.buyingDate) : null,
        }));
        if (this.isAdmin) {
          if (!selectedWarehouseId) {
            mappedProducts = [];
          } else {
            // Services have no warehouse (globally sellable) — keep them alongside
            // this warehouse's physical stock.
            mappedProducts = mappedProducts.filter((p: Product) =>
              p.productType === 'SERVICE' ||
              Number((p.warehouse as any)?.warehouseId) === Number(selectedWarehouseId)
            );
          }
        }
        this.products = mappedProducts;

        if (this.selectedCategory?.categoryId) {
          this.filteredProducts = this.products.filter((product: Product) =>
            Number(product.category?.categoryId) === Number(this.selectedCategory.categoryId)
          );
        } else {
          this.filteredProducts = [];
        }

        // Assign totals from backend
        this.totalRecords = res.totalProducts;

        this.isLoading = false;
      },
      error: (err: any) => {
        console.error(err);
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_orders'),
          life: 3000
        });
      }
    });
  }

  // async onGetAllProducts() {
  //   await this.productService.getProducts()
  //     .subscribe({
  //       next: (response: any) => {
  //         this.products = response;
  //         this.products.forEach((product: any) => (product.creationDate = new Date(<Date>product.creationDate)));
  //         console.log(this.products);
  //         this.cdr.markForCheck();
  //       },
  //       error: (err: any) => {
  //         this.messageService.add({
  //           severity: 'error',
  //           summary: this.translate.instant('error'),
  //           detail: this.translate.instant('error_while_getting_products'),
  //           life: 3000
  //         });
  //       }
  //     })
  // }

  async onGetQuickProducts() {
    const selectedWarehouseId = this.getSelectedOrderWarehouseId();
    if (this.isAdmin && !selectedWarehouseId) {
      this.quickProducts = [];
      return;
    }
    await this.productService.getQuickProducts()
      .subscribe({
        next: (response: any) => {
          this.quickProducts = response.filter((product: Product) =>
            !this.isAdmin ||
            product.productType === 'SERVICE' ||
            Number((product.warehouse as any)?.warehouseId) === Number(selectedWarehouseId)
          );
          console.log(this.quickProducts);
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_products'),
            life: 3000
          });
        }
      })
  }

  async onGetAllWarehouses() {
    await this.warehouseService.getWarehouses().subscribe({
      next: (response: any) => {
        this.warehouses = response;
        if (this.isAdmin && !this.selectedOrderWarehouse && Array.isArray(this.warehouses) && this.warehouses.length === 1) {
          this.selectedOrderWarehouse = this.warehouses[0];
          this.onOrderWarehouseChange();
        }
        this.alignOrderSelectionsWithLoadedLists();
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_warehouses'),
          life: 3000,
        });
      },
    });
  }

  async onGetAllCustomers() {
    await this.customerService.getCustomers()
      .subscribe({
        next: (response: any) => {
          this.customers = response;
          this.customers = this.customers.map(customer => ({
            ...customer,
            fullName: this.getCustomerDisplayName(customer)
          }));
          console.log(this.customers);

          // UX: if there is only one customer and we are creating a new order, preselect it
          this.hasSingleCustomer = Array.isArray(this.customers) && this.customers.length === 1;
          if (this.hasSingleCustomer && (!this.order || !this.order.orderId) && !this.order.customer) {
            this.order.customer = this.customers[0];
          }
          this.alignOrderSelectionsWithLoadedLists();
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_customers'),
            life: 3000
          });
        }
      })
  }

  async onGetAllShops() {
    await this.shopService.getShops()
      .subscribe({
        next: (response: any) => {
          this.shops = response;
          console.log(this.shops);

          // UX: if there is only one shop and we are creating a new order, preselect it
          this.hasSingleShop = Array.isArray(this.shops) && this.shops.length === 1;
          if (this.hasSingleShop && (!this.order || !this.order.orderId) && !this.order.shop) {
            this.order.shop = this.shops[0];
          }
          this.alignOrderSelectionsWithLoadedLists();
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_shops'),
            life: 3000
          });
        }
      })
  }

  async onGetOrganization() {
    if (!this.isAdmin) {
      this.organization = null;
      return;
    }
    await this.organizationService.getOrganization()
      .subscribe({
        next: (response: any) => {
          this.organization = response;
          console.log(this.organization);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_organization'),
            life: 3000
          });
        }
      })
  }

  private async resolveExportLocale(): Promise<string> {
    if (!this.isAdmin) {
      return this.translate.currentLang || this.translateService.getPreferredLanguage() || 'en';
    }

    await this.organizationService.loadToken();
    const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
    return organization?.defaultLocale || this.translate.currentLang || this.translateService.getPreferredLanguage() || 'en';
  }

  async onGetAllOrderReturn(orderId) {
    await this.orderService.getOrdersReturns(orderId)
      .subscribe({
        next: (response: any) => {
          this.orderReturns = response;
          console.log(this.orderReturns);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_order_return_items'),
            life: 3000
          });
        }
      })
  }

  async onGetOrderPayments(orderId) {
    this.paymentService.getPaymentsByOrderId(orderId)
      .subscribe({
        next: (response: any) => {
          this.orderPayments = response;
          console.log(this.orderPayments);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_order_payments'),
            life: 3000
          });
        }
      })
  }


  async onDeleteOrder(id: any, force: boolean = false) {
    this.orderService.deleteOrder(id, force).subscribe({
      next: () => {
        this.loadOrders();     // ⬅️ clean reload using cached lazy params
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_deleting_order'),
          life: 3000
        });
      }
    });
  }


  async updateOrder(id: any, order: any): Promise<Order> {
    order.products = this.targetProducts;

    return new Promise((resolve, reject) => {
      this.orderService.updateOrder(id, order).subscribe({
        next: (response: any) => {
          this.loadOrders();     // ⬅️ reload with same page + same sorting
          this.loadProducts();
          resolve(response);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_order'),
            life: 3000
          });
          reject(err);
        }
      });
    });
  }

  async addOrder(order: any, checkoutReservationContext?: string | null): Promise<Order> {
    console.log('Saving order:', order);

    return new Promise((resolve, reject) => {
      const saveOpts =
        checkoutReservationContext && String(checkoutReservationContext).trim()
          ? { checkoutReservationContext: String(checkoutReservationContext).trim() }
          : undefined;
      this.orderService.saveOrder(order, saveOpts).subscribe({
        next: (response: any) => {
          console.log('Order saved successfully:', response);

          if (this.dt) {
            this.dt.first = 0; // reset paginator
          }

          // Reload first page with SAME filters & sorting
          this.loadOrders();

          this.loadProducts();
          resolve(response);
        },
        error: (err: any) => {
          console.error('Error saving order:', err);

          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_order'),
            life: 3000
          });

          reject(err);
        }
      });
    });
  }


  async addCustomer(data: any): Promise<any> {
    await this.customerService.saveCustomer(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllCustomers();
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_customer'),
            life: 3000
          });
          console.log(err);
          return false;
        },
      })
  }

  async addShop(data: any): Promise<any> {
    await this.shopService.saveShop(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllShops();
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_shop'),
            life: 3000
          });
          console.log(err);
          return false;
        },
      })
  }

  onSortChange(event: any) {
    const value = event.value;

    if (value.indexOf('!') === 0) {
      this.sortOrder = -1;
      this.sortField = value.substring(1, value.length);
    } else {
      this.sortOrder = 1;
      this.sortField = value;
    }
  }

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

      const defaultLocale = await this.resolveExportLocale();
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      // Fetch all filtered orders from backend using pagination
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredOrders: any[] = [];
      const pageSize = 1000;
      let currentPage = 0;
      let hasMorePages = true;
      const maxPages = 100; // Safety limit
      
      // Build filters object from component filter properties (same as loadOrders)
      const { sortField, sortOrder } = this.lastLazyLoadEvent;
      // PrimeNG convention: sortOrder -1 = descending, 1 = ascending.
      const direction = sortOrder === -1 ? 'DESC' : 'ASC';
      const filterPayload: any = { ...this.lastLazyLoadEvent.filters };
      
      // Ensure token is loaded
      this.orderService.loadToken();
      
      // Fetch all pages
      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;
        
        const response: any = await firstValueFrom(
          this.orderService.getOrdersPaginated(
            currentPage,
            pageSize,
            this.lastLazyLoadEvent.globalFilter || '',
            sortField || 'orderDate',
            direction,
            filterPayload
          )
        );
        
        const pageContent = response.page?.content || response.content || response || [];
        allFilteredOrders = allFilteredOrders.concat(pageContent);
        
        // Check if there are more pages
        const totalElements = response.totalOrders || response.page?.totalElements || response.totalElements || response.total || 0;
        // Keep loading while we haven't fetched all elements and the backend still returns data
        hasMorePages = allFilteredOrders.length < totalElements && pageContent.length > 0;
        currentPage++;
      }
      
      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';
      
      // Build translated export columns based on organization's default locale
      const translationKeyMap: { [key: string]: string } = {
        'reference': 'order_reference',
        'totalAmount': 'order_total_amount',
        'itemsCount': 'order_items',
        'Customer': 'order_customer',
        'orderDate': 'order_date'
      };
      
      const translatedExportColumns: ExportColumn[] = this.exportColumns
        .filter((col) => col.dataKey !== 'creationDate') // Exclude creationDate
        .map((col) => {
          const translationKey = translationKeyMap[col.dataKey] || col.dataKey;
          return {
            title: this.translate.instant(translationKey),
            dataKey: col.dataKey
          };
        });
      
      // Get translated title for PDF
      const pdfTitle = this.translate.instant('orders_menu_title') || this.translate.instant('orders');
      
      // Prepare orders for export with formatted fields
      const exportData = allFilteredOrders.map(order => {
        const exportItem: any = { ...order };
        
        // Format dates as numeric date (dd/MM/yyyy)
        if (exportItem.orderDate) {
          const date = exportItem.orderDate instanceof Date 
            ? exportItem.orderDate 
            : new Date(exportItem.orderDate);
          exportItem.orderDate = this.datePipe.transform(date, 'dd/MM/yyyy') || '';
        }
        
        if (exportItem.deliveryDate) {
          const date = exportItem.deliveryDate instanceof Date 
            ? exportItem.deliveryDate 
            : new Date(exportItem.deliveryDate);
          exportItem.deliveryDate = this.datePipe.transform(date, 'dd/MM/yyyy') || '';
        }
        
        if (exportItem.completeDate) {
          const date = exportItem.completeDate instanceof Date 
            ? exportItem.completeDate 
            : new Date(exportItem.completeDate);
          exportItem.completeDate = this.datePipe.transform(date, 'dd/MM/yyyy') || '';
        }
        
        // Extract customer display name (handles Particular vs Company)
        if (exportItem.customer) {
          if (typeof exportItem.customer === 'object') {
            exportItem.Customer = this.getCustomerDisplayName(exportItem.customer);
          } else {
            exportItem.Customer = exportItem.customer;
          }
        } else {
          exportItem.Customer = 'N/A';
        }
        
        // Compute items count from order items
        const items = exportItem.orderItems;
        exportItem.itemsCount = Array.isArray(items) ? items.length : 0;
        
        // Remove unwanted fields
        delete exportItem.creationDate;
        delete exportItem.customer;
        
        return exportItem;
      });
      
      // Export with translated headers and title
      this.reportingService.exportPdf(translatedExportColumns, exportData, 'orders', pdfTitle, this.organization?.organizationName);
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredOrders.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting orders PDF:', error);
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

      const defaultLocale = await this.resolveExportLocale();
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      // Fetch all filtered orders from backend using pagination
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredOrders: any[] = [];
      const pageSize = 1000;
      let currentPage = 0;
      let hasMorePages = true;
      const maxPages = 100; // Safety limit
      
      // Build filters object from component filter properties (same as loadOrders)
      const { sortField, sortOrder } = this.lastLazyLoadEvent;
      // PrimeNG convention: sortOrder -1 = descending, 1 = ascending.
      const direction = sortOrder === -1 ? 'DESC' : 'ASC';
      const filterPayload: any = { ...this.lastLazyLoadEvent.filters };
      
      // Ensure token is loaded
      this.orderService.loadToken();
      
      // Fetch all pages
      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;
        
        const response: any = await firstValueFrom(
          this.orderService.getOrdersPaginated(
            currentPage,
            pageSize,
            this.lastLazyLoadEvent.globalFilter || '',
            sortField || 'orderDate',
            direction,
            filterPayload
          )
        );
        
        const pageContent = response.page?.content || response.content || response || [];
        allFilteredOrders = allFilteredOrders.concat(pageContent);
        
        // Check if there are more pages
        const totalElements = response.totalOrders || response.page?.totalElements || response.totalElements || response.total || 0;
        // Keep loading while we haven't fetched all elements and the backend still returns data
        hasMorePages = allFilteredOrders.length < totalElements && pageContent.length > 0;
        currentPage++;
      }
      
      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';
      
      // Map column field names to translation keys
      const translationKeyMap: { [key: string]: string } = {
        'reference': 'order_reference',
        'totalAmount': 'order_total_amount',
        'itemsCount': 'order_items',
        'Customer': 'order_customer',
        'orderDate': 'order_date'
      };
      
      // Prepare orders for export with formatted fields
      const modifiedOrders = allFilteredOrders.map(order => {
        const modifiedOrder: any = { ...order };

        // Format dates as numeric date (dd/MM/yyyy)
        if (modifiedOrder.orderDate) {
          const date = modifiedOrder.orderDate instanceof Date 
            ? modifiedOrder.orderDate 
            : new Date(modifiedOrder.orderDate);
          modifiedOrder.orderDate = this.datePipe.transform(date, 'dd/MM/yyyy') || '';
        }
        
        if (modifiedOrder.deliveryDate) {
          const date = modifiedOrder.deliveryDate instanceof Date 
            ? modifiedOrder.deliveryDate 
            : new Date(modifiedOrder.deliveryDate);
          modifiedOrder.deliveryDate = this.datePipe.transform(date, 'dd/MM/yyyy') || '';
        }
        
        if (modifiedOrder.completeDate) {
          const date = modifiedOrder.completeDate instanceof Date 
            ? modifiedOrder.completeDate 
            : new Date(modifiedOrder.completeDate);
          modifiedOrder.completeDate = this.datePipe.transform(date, 'dd/MM/yyyy') || '';
        }
        
        // Extract customer display name (handles Particular vs Company)
        if (modifiedOrder.customer) {
          if (typeof modifiedOrder.customer === 'object') {
            modifiedOrder.Customer = this.getCustomerDisplayName(modifiedOrder.customer);
          } else {
            modifiedOrder.Customer = modifiedOrder.customer;
          }
        } else {
          modifiedOrder.Customer = 'N/A';
        }
        
        // Compute items count from order items
        const items = modifiedOrder.orderItems;
        modifiedOrder.itemsCount = Array.isArray(items) ? items.length : 0;

        // Remove unwanted fields
        delete modifiedOrder.creationDate;
        delete modifiedOrder.customer;

        return modifiedOrder;
      });

      // Create a translated version of the data with translated headers
      // For Excel, we need to create objects with translated keys
      const translatedOrders = modifiedOrders.map(order => {
        const translated: any = {};
        this.cols.forEach(col => {
          // Exclude creationDate
          if (col.field !== 'creationDate') {
            const translationKey = translationKeyMap[col.field] || col.field;
            const translatedHeader = this.translate.instant(translationKey);
            translated[translatedHeader] = (order as any)[col.field];
          }
        });
        return translated;
      });

      // Now, export the translated array to Excel
      this.reportingService.exportExcel(translatedOrders, 'orders', {
        title: this.translate.instant('orders_menu_title'),
        organizationName: this.organization?.organizationName,
        generatedLabel: this.translate.instant('export_generated_on'),
        generatedAt: new Date().toLocaleString(defaultLocale),
      });
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredOrders.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting orders Excel:', error);
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

  onChangeCountry() {
    this.customer.city = undefined;
  }

  onSelectedCountry(event) {
    if ((this.customer.country != this.selectedCountry) && (this.customer.city == undefined)) this.customer.city = undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    this.states = this.locationService.getStatesByCountryCode(this.selectedCountry.isoCode);

  }

  showOrderStatus(order) {
    if (!order || !order.orderId) return;
    this.router.navigate(['/sales/orders', order.orderId]);
  }


  async editOrderStatus(id: any, order: any): Promise<boolean> {
    try {
      const response = await this.orderService.updateOrderStatus(id, order).toPromise();
      console.log(response);

      this.loadOrders();
      return true;
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_updating_order'),
        life: 3000
      });
      return false;
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
          product.orderItemPricePerUnit = item.sellingPrice;
          product.orderItemPricePerUnitManual = false;
          product.orderItemQuantity = this.defaultLineQuantity(product);
          void this.loadOptionSetsForLine(product);
        }
      });
    });
    // Force change detection
    this.scheduleSyncCheckoutReservations();
    this.cdr.detectChanges();
  }

  //function to move scanned products to target
  moveProductToTarget(product: any): void {
    const availableQty = this.getAvailableQuantity(product);
    if (this.isProduct(product) && (availableQty === null || availableQty === undefined || availableQty <= 0)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('product_quantity_insufficient'),
        life: 3000,
      });
      return;
    }

    const existingProduct = this.targetProducts.find(targetProduct => targetProduct.productId === product.productId);

    if (!existingProduct) {
      const newProduct = {
        ...product,
        orderItemPricePerUnit: product.sellingPrice,
        orderItemPricePerUnitManual: false,
        orderItemQuantity: this.defaultLineQuantity(product)
      };
      this.targetProducts.push(newProduct);
      this.sourceProducts = this.sourceProducts.filter(p => p.productId !== product.productId);
      this.orderItems.push(newProduct);
      void this.loadOptionSetsForLine(newProduct);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('product_added_success'),
        life: 3000,
      });
      this.scheduleSyncCheckoutReservations();
      this.cdr.detectChanges();
    } else {
      existingProduct.orderItemQuantity += this.quantityInputStep(existingProduct);
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('info'),
        detail: this.translate.instant('product_quantity_increased'),
        life: 3000,
      });
      this.scheduleSyncCheckoutReservations();
      this.cdr.detectChanges();
    }
  }

  // ---------------------------------------------------------------------
  // Sale-line options (components/cuts) — pick options on an order line
  // ---------------------------------------------------------------------

  /**
   * Load the option sets applicable to a line's product and seed default selections. Purely
   * additive: products without option sets simply get an empty list and no options control shows.
   */
  /** Fetch every active option set once; applicability is resolved per line client-side. */
  private async getAllOptionSets(): Promise<LineOptionSet[]> {
    if (this.allOptionSetsCache) return this.allOptionSetsCache;
    try {
      const obs = await this.lineOptionSetService.list();
      const res = await firstValueFrom(obs);
      this.allOptionSetsCache = (Array.isArray(res) ? res : []).filter(s => s.active !== false);
    } catch (e: any) {
      if (e?.status !== 404) console.warn('Could not load line option sets', e);
      this.allOptionSetsCache = [];
    }
    return this.allOptionSetsCache;
  }

  /** Sets applicable to a product: product-scoped, its category-scoped, or global (both null). */
  private applicableOptionSets(product: any): LineOptionSet[] {
    const pid = product?.productId;
    const cid = product?.category?.categoryId ?? product?.categoryId ?? null;
    return (this.allOptionSetsCache || []).filter(s =>
      (s.productId != null && s.productId === pid) ||
      (s.categoryId != null && cid != null && s.categoryId === cid) ||
      (s.productId == null && s.categoryId == null)
    );
  }

  async loadOptionSetsForLine(product: any, preserveSelections = false): Promise<void> {
    const pid = product?.productId;
    if (!pid) return;
    try {
      await this.getAllOptionSets();
      const sets = this.applicableOptionSets(product);
      product['lineOptionSets'] = sets;
      if (!preserveSelections || !product['lineOptionSelections']) {
        // On edit, distribute previously-saved option ids into their sets; otherwise seed defaults.
        const pending: number[] | undefined = product['__pendingSelectedOptionIds'];
        const selections: { [setId: number]: number[] } = {};
        for (const set of sets) {
          const setId = set.lineOptionSetId as number;
          const setOptionIds = (set.options || []).map(o => o.lineOptionId as number);
          if (pending && pending.length) {
            selections[setId] = pending.filter(id => setOptionIds.includes(id));
          } else {
            const defaults = (set.options || [])
              .filter(o => o.active !== false && o.defaultSelected && o.lineOptionId != null)
              .map(o => o.lineOptionId as number);
            selections[setId] = set.selectionMode === 'SINGLE' ? defaults.slice(0, 1) : defaults;
          }
        }
        product['lineOptionSelections'] = selections;
        delete product['__pendingSelectedOptionIds'];
      }
      this.cdr.detectChanges();
    } catch (e: any) {
      // Endpoint absent (older backend) or transient error: behave as before (no options control).
      if (e?.status !== 404) {
        console.warn('Could not load line option sets for product', pid, e);
      }
      product['lineOptionSets'] = [];
    }
  }

  hasLineOptions(product: any): boolean {
    return Array.isArray(product?.['lineOptionSets']) && product['lineOptionSets'].length > 0;
  }

  getLineOptionSets(product: any): LineOptionSet[] {
    return product?.['lineOptionSets'] || [];
  }

  private selectionsFor(product: any, setId: number): number[] {
    const sel = product['lineOptionSelections'] || (product['lineOptionSelections'] = {});
    return sel[setId] || (sel[setId] = []);
  }

  isOptionSelected(product: any, set: LineOptionSet, option: LineOption): boolean {
    return this.selectionsFor(product, set.lineOptionSetId as number).includes(option.lineOptionId as number);
  }

  toggleOption(product: any, set: LineOptionSet, option: LineOption): void {
    const setId = set.lineOptionSetId as number;
    const optId = option.lineOptionId as number;
    const current = this.selectionsFor(product, setId);
    const idx = current.indexOf(optId);
    if (set.selectionMode === 'SINGLE') {
      // Radio behaviour: selecting replaces; clicking the selected one clears it only if min allows.
      if (idx > -1) {
        product['lineOptionSelections'][setId] = (set.minSelect || 0) > 0 ? [optId] : [];
      } else {
        product['lineOptionSelections'][setId] = [optId];
      }
      return;
    }
    // MULTI: toggle, respecting maxSelect
    if (idx > -1) {
      current.splice(idx, 1);
    } else {
      if (set.maxSelect != null && current.length >= set.maxSelect) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('line_option_max_reached', { max: set.maxSelect }),
          life: 3000,
        });
        return;
      }
      current.push(optId);
    }
  }

  /** Total selected options on a line (badge count). */
  lineOptionsCount(product: any): number {
    const sel = product?.['lineOptionSelections'];
    if (!sel) return 0;
    let total = 0;
    for (const arr of Object.values(sel) as any[]) {
      if (Array.isArray(arr)) total += arr.length;
    }
    return total;
  }

  /** Labels of selected options on a line, for the chips summary. */
  lineOptionsSummary(product: any): string[] {
    const labels: string[] = [];
    for (const set of this.getLineOptionSets(product)) {
      const chosen = this.selectionsFor(product, set.lineOptionSetId as number);
      for (const opt of (set.options || [])) {
        if (opt.lineOptionId != null && chosen.includes(opt.lineOptionId)) {
          labels.push(opt.label || opt.code || '');
        }
      }
    }
    return labels;
  }

  /** True when every set on the line satisfies its min/max selection constraints. */
  lineOptionsValid(product: any): boolean {
    for (const set of this.getLineOptionSets(product)) {
      const count = this.selectionsFor(product, set.lineOptionSetId as number).length;
      if (count < (set.minSelect || 0)) return false;
      if (set.maxSelect != null && count > set.maxSelect) return false;
    }
    return true;
  }

  private allLinesOptionsValid(): boolean {
    return (this.targetProducts || []).every(p => this.lineOptionsValid(p));
  }

  openLineOptionsDialog(product: any): void {
    this.optionsLine = product;
    if (!product['lineOptionSets']) {
      void this.loadOptionSetsForLine(product, true);
    }
    this.optionsDialogVisible = true;
  }

  closeLineOptionsDialog(): void {
    this.optionsDialogVisible = false;
    this.optionsLine = null;
  }

  /** Flatten a line's selections to the backend wire format: [{ lineOptionId }]. */
  private buildSelectedOptionsPayload(product: any): { lineOptionId: number }[] {
    const sel = product?.['lineOptionSelections'];
    if (!sel) return [];
    const ids: number[] = [];
    for (const arr of Object.values(sel) as any[]) {
      if (Array.isArray(arr)) ids.push(...(arr as number[]));
    }
    return ids.map(id => ({ lineOptionId: id }));
  }



  async updateOrderStatus() {
    if (this.order.orderStatus != 'Canceled')
      try {
        this.loading = true; // Set loading flag to true

        // Get the current status of the order
        const currentStatus = this.order.orderStatus;

        // Find the sequence for the current status
        const sequence = this.statusSequences[currentStatus];

        // If there are no next statuses in the sequence, exit the method
        if (!sequence || sequence.length === 0) {
          return;
        }

        // Progress to the next status in the sequence (assuming only one next status)
        const nextStatus = sequence[0]; // Assuming only one next status

        // Update the order status
        this.order.orderStatus = nextStatus;

        // Update the existing events with the corresponding date from the order
        await this.editOrderStatus(this.order.orderId, this.order);

        // Find the index of the current status in the original events array
        const currentStatusIndex = this.originalEvents.findIndex(event => event.status === nextStatus);

        // Filter the original events array to include all events up to the current status
        const filteredEvents = this.originalEvents.slice(0, currentStatusIndex + 1);

        // Assign the filtered events to the events array
        this.events = filteredEvents;
        this.cdr.detectChanges(); // Detect changes to update the UI

        this.syncEventDates(this.events);

        // window.location.reload();

      } finally {
        this.loading = false; // Set loading flag to false when the operation is completed
        this.showOrderStatus(this.order); // Show the order status dialog

      }
  }


  syncEventDates(events: any[]) {
    events.forEach(event => {
      switch (event.status) {
        case 'Ordered':
          event.date = this.order.orderDate ? new Date(this.order.orderDate) : null;
          break;
        case 'Processing':
          event.date = this.order.processingDate ? new Date(this.order.processingDate) : null;
          break;
        case 'Delivered':
          event.date = this.order.deliveryDate ? new Date(this.order.deliveryDate) : null;
          break;
        case 'Completed':
          event.date = this.order.completeDate ? new Date(this.order.completeDate) : null;
          break;
        case 'Canceled':
          event.date = this.order.cancelDate ? new Date(this.order.cancelDate) : null;
          break;
        case 'Return_Pending':
          event.date = this.order.returnPendingDate ? new Date(this.order.returnPendingDate) : null;
          break;
        case 'Partial_Return':
        case 'Returned':
          event.date = this.order.returnDate ? new Date(this.order.returnDate) : null;
          break;
        default:
          event.date = this.order.orderDate ? new Date(this.order.orderDate) : null;
          break;
      }
    });
  }

  allowCancelOrder(order: Order): boolean {
    return order.orderStatus === 'Ordered'; // Adjust the condition based on your status criteria
  }

  async cancelOrderFromTable(order: Order) {
    try {
      order.orderStatus = "Canceled";
      // Update the existing events with the corresponding date from the order
      await this.editOrderStatus(order.orderId, order);
      this.syncEventDates(this.events);
      this.loadOrders();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('order_canceled'),
        life: 3000
      });
      // this.cdr.detectChanges();

    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_canceling_order'),
        life: 3000
      });
    }
  }

  async processOrderFromTable(order: Order) {
    try {
      order.orderStatus = "Processing";
      order.processingDate = new Date();
      // Update the existing events with the corresponding date from the order
      await this.editOrderStatus(order.orderId, order);
      this.loadOrders();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('order_under_processing'),
        life: 3000
      });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_updating_order'),
        life: 3000
      });
    }
  }

  async deliverOrderFromTable(order: Order) {
    try {
      order.orderStatus = "Delivered";
      order.deliveryDate = new Date();
      // Update the existing events with the corresponding date from the order
      await this.editOrderStatus(order.orderId, order);
      this.loadOrders();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('order_delivered'),
        life: 3000
      });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_updating_order'),
        life: 3000
      });
    }
  }

  async completeOrderFromTable(order: Order) {
    try {
      order.orderStatus = "Completed";
      order.completeDate = new Date();
      // Update the existing events with the corresponding date from the order
      await this.editOrderStatus(order.orderId, order);
      this.loadOrders();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('order_completed_text'),
        life: 3000
      });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_updating_order'),
        life: 3000
      });
    }
  }

  async cancelOrder(order: Order) {
    try {
      this.order.orderStatus = "Canceled";
      // Update the existing events with the corresponding date from the order
      await this.editOrderStatus(this.order.orderId, this.order);
      // Find the index of the 'Canceled' status in the original events array
      const cancelStatusIndex = this.originalEvents.findIndex(event => event.status === 'Canceled');

      // Filter the original events array to include all events up to the 'Canceled' status
      const filteredEvents = this.originalEvents.slice(0, cancelStatusIndex + 1);

      // Assign the filtered events to the events array
      if (this.order.orderStatus === 'Canceled') {
        this.events = filteredEvents.filter(event => event.status !== 'Delivered' && event.status !== 'Completed' && event.status !== 'Returned' && event.status !== 'Partial_Return' && event.status !== 'Processing' && event.status !== 'Return_Pending');
      } else {
        // Assign the filtered events to the events array
        this.events = filteredEvents;
      }
      this.syncEventDates(this.events);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('order_canceled'),
        life: 3000
      });
      this.loadOrders();

    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_canceling_order'),
        life: 3000
      });
    }
  }

  onDiscountChange(): void {
    if (this.discountType === 'Percentage') {
      // If percentage, convert it to an amount
      this.order.discount = Math.min(this.order.discount, 100); // Ensure percentage does not exceed 100%
    }
  }

  getTotalWithoutCredit(): number {
    const subtotal = this.getSubtotal();
    const discountAmount = this.calculateDiscountAmount();
    const taxableAmount = subtotal - discountAmount;
    // In TTC mode the tax is already inside the goods amount, so it is not added again.
    const taxToAdd = this.taxInclusive ? 0 : this.calculateTax(taxableAmount);
    const transportAmount = this.order.transportAmount || 0;
    const additionalCharges = this.order.additionalChargesAmount || 0;
    return taxableAmount + taxToAdd + transportAmount + additionalCharges;
  }

  calculateTotalAmount(): number {
    this.maybeRefreshRuleTaxRate();
    // Recalculate credit usage when total changes
    if (this.creditInfo && this.showPaymentSection) {
      const orderTotal = this.getTotalWithoutCredit();
      const availableCredit = this.creditInfo.availableCredit || 0;
      this.creditAmountUsed = Math.min(orderTotal, availableCredit);
    }
    const subtotal = this.getSubtotal();
    const discountAmount = this.calculateDiscountAmount();
    const taxableAmount = subtotal - discountAmount;
    // In TTC mode the tax is already inside the goods amount, so it is not added again.
    const taxToAdd = this.taxInclusive ? 0 : this.calculateTax(taxableAmount);
    const transportAmount = this.order.transportAmount || 0;
    const additionalCharges = this.order.additionalChargesAmount || 0;

    return taxableAmount + taxToAdd + transportAmount + additionalCharges;
  }


  calculateTax(amount: number): number {
    if (!this.taxEnabled || this.isCustomerTaxExempt()) return 0;
    if (this.taxInclusive) {
      // TTC: the amount already includes tax — extract it rather than add on top.
      return this.taxRate > 0 ? amount - amount / (1 + this.taxRate) : 0;
    }
    return amount * this.taxRate; // 0.2 * amount = 20% of amount
  }

  /** A tax-exempt customer is never taxed, regardless of mode or rules (matches backend). */
  isCustomerTaxExempt(): boolean {
    return !!this.order?.customer?.taxExempt;
  }

  getTotalWithoutTax(): number {
    let total = 0;
    for (const product of this.targetProducts) {
      total += product.orderItemQuantity * product.orderItemPricePerUnit;
    }
    return total - this.order.discount;
  }

  get displayTaxRate(): number {
    return this.taxRate * 100;
  }

  // Setter from input back to internal fractional value
  set displayTaxRate(value: number) {
    this.taxRate = value / 100;
    this.calculateTotalAmount();
  }

  calculateTotalAmountWithoutTax(): number {
    let total = 0;

    // Calculate the total based on product quantities and prices
    for (const product of this.targetProducts) {
      total += product.orderItemQuantity * product.orderItemPricePerUnit;
    }

    // Apply discount
    if (this.discountType === 'Percentage') {
      total -= total * (this.order.discount / 100);
    } else {
      total -= this.order.discount;
    }

    // Ensure the total is not below zero after applying the discount
    if (total < 0) {
      total = 0;
    }

    return total;
  }


  searchProductByBarcode(barcode: string): Product | undefined {
    const code = barcode.trim().toLowerCase();
    return this.sourceProducts.find((p: Product) => (p.reference || '').trim().toLowerCase() === code);
  }

  /**
   * A scanned code is usually a barcode value, not the product reference, so an unmatched code is
   * resolved through the barcode API and mapped back to the picklist (only products available for
   * this order can be added).
   */
  private async resolveScannedSourceProduct(code: string): Promise<Product | undefined> {
    const local = this.searchProductByBarcode(code);
    if (local) {
      return local;
    }
    try {
      this.barcodeService.loadToken();
      const scan = await firstValueFrom(this.barcodeService.scanBarcode(code));
      if (scan?.found && scan.productId) {
        return this.sourceProducts.find((p: Product) => p.productId === scan.productId);
      }
    } catch {
      // scanner path: stay silent, the code simply does not resolve
    }
    return undefined;
  }

  // Check if a key is a valid alphanumeric character
  isAlphanumeric(key: string): boolean {
    const isAlphaNum = /^[a-zA-Z0-9]$/.test(key);
    return isAlphaNum;
  }

  async processBarcode(force = false): Promise<void> {
    const code = (this.barcode || '').trim();
    this.resetBarcodeBuffer();

    if ((!force && code.length < this.barcodeMinLength) || !code || this.barcodeLookupInProgress) {
      return;
    }

    this.barcodeLookupInProgress = true;
    try {
      const product = await this.resolveScannedSourceProduct(code);
      if (product) {
        this.addProductToOrder(product);
      }
    } finally {
      this.barcodeLookupInProgress = false;
    }
  }

  private resetBarcodeBuffer(): void {
    this.barcode = '';
    this.lastBarcodeKeyAt = 0;
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
  }

  /** Never capture keystrokes that are being typed into a field — only a scanner burst. */
  private shouldIgnoreBarcodeKeyEvent(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }
    return !!target.closest(
      'input, textarea, select, [contenteditable="true"], .p-inputnumber, .p-autocomplete, .p-dropdown, .p-calendar, .p-multiselect, .p-inputtext'
    );
  }


  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.scanning || event.ctrlKey || event.altKey || event.metaKey || this.shouldIgnoreBarcodeKeyEvent(event)) {
      this.resetBarcodeBuffer();
      return;
    }

    const key = event.key;

    if (key === 'Enter') {
      void this.processBarcode(true);
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
      void this.processBarcode();
    }, this.barcodeIdleMs);
  }

  getCustomerDisplayName(customer: any): string {
    if (!customer) return 'N/A';

    if (customer.customerType === 'Company') {
      return customer.companyName || 'Unnamed Company';
    }

    return [customer.firstName, customer.lastName]
      .filter(name => name)
      .join(' ') || 'Unnamed Customer';
  }

  getTotalSpent(): number {
    return this.orders?.reduce((total, order) => total + (order.totalAmount || 0), 0) || 0;
  }

  getTotalPaid(): number {
    return this.orders?.reduce((total, order) => {
      return total + (order.totalPaid || 0);
    }, 0) || 0;
  }

  // Calculate remaining balance
  getRemainingBalance(): number {
    return this.getTotalSpent() - this.getTotalPaid();
  }

  getPaymentMethodIcon(method: string): string {
    switch (method) {
      case 'Cash': return 'pi-money-bill';
      case 'Card': return 'pi-credit-card';
      case 'Check': return 'pi-file-edit';
      case 'Transfer': return 'pi-send';
      case 'BOE': return 'pi-file-excel';
      default: return 'pi-money-bill';
    }
  }



  filterByCategory(): void {
    if (!this.selectedCategory?.categoryId) {
      this.filteredProducts = [];
      this.updateProductsFilter('categoryId', null);
      return;
    }

    this.filteredProducts = [];
    this.updateProductsFilter('categoryId', this.selectedCategory.categoryId);
    this.isLoading = true;
    this.loadProducts();
  }

  filterCategories(event: any): void {
    const query = event.query?.toLowerCase() || '';
    if (!query) {
      this.filteredCategories = [...this.categories];
    } else {
      this.filteredCategories = this.categories.filter(c =>
        c.categoryName.toLowerCase().includes(query)
      );
    }
  }

  clearCategoryFilter(): void {
    this.selectedCategory = null;
    this.filteredProducts = [];
    this.updateProductsFilter('categoryId', null);
    this.isLoading = true;
    this.loadProducts();
  }

  filterProducts(event: any): void {
    const query = (event?.query || '').trim();
    const requestToken = ++this.latestProductSuggestionToken;
    const selectedWarehouseId = this.getSelectedOrderWarehouseId();
    if (this.isAdmin && !selectedWarehouseId) {
      this.productSuggestions = [];
      this.productSuggestionsLoading = false;
      return;
    }

    this.productSuggestionsLoading = true;

    this.productService.searchProductsForOrder(query, selectedWarehouseId).subscribe({
      next: (response: any) => {
        if (requestToken !== this.latestProductSuggestionToken) {
          return;
        }

        const matchingProducts = this.normalizeProductSearchResponse(response);
        this.productSuggestions = this.prepareProductSuggestions(matchingProducts);
        this.productSuggestionsLoading = false;
      },
      error: (error: any) => {
        console.error('Error while searching products for autocomplete:', error);

        if (requestToken !== this.latestProductSuggestionToken) {
          return;
        }

        this.productSuggestions = [];
        this.productSuggestionsLoading = false;

        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_products'),
          life: 3000
        });
      }
    });
  }

  onOrderWarehouseChange(): void {
    this.targetProducts = [];
    this.orderItems = [];
    this.selectedProduct = null;
    this.productSuggestions = [];
    this.filteredProducts = [];
    this.onGetQuickProducts();
    this.loadProducts();
  }

  private getSelectedOrderWarehouseId(): number | undefined {
    if (!this.selectedOrderWarehouse) return undefined;
    const rawId = (this.selectedOrderWarehouse as any).warehouseId ?? (this.selectedOrderWarehouse as any).id;
    if (rawId == null) return undefined;
    const id = Number(rawId);
    return Number.isNaN(id) ? undefined : id;
  }

  private normalizeProductSearchResponse(response: any): Product[] {
    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response;
    }

    if (response.page?.content && Array.isArray(response.page.content)) {
      return response.page.content;
    }

    if (Array.isArray(response.content)) {
      return response.content;
    }

    if (Array.isArray(response.items)) {
      return response.items;
    }

    return [];
  }

  private prepareProductSuggestions(products: Product[]): Product[] {
    const selectedWarehouseId = this.getSelectedOrderWarehouseId();
    const selectedProductIds = new Set(
      this.targetProducts.map(product => product.productId)
    );

    return products.filter(product =>
      (!this.isAdmin ||
        product?.productType === 'SERVICE' ||
        (selectedWarehouseId != null && Number((product.warehouse as any)?.warehouseId) === Number(selectedWarehouseId))) &&
      (product?.productType === 'SERVICE' || (this.getAvailableQuantity(product) > 0)) &&
      !selectedProductIds.has(product.productId)
    );
  }

  onProductSelect(event: any): void {
    const selectedProduct = event.value;
    console.log('Selected product:', selectedProduct);

    if (!selectedProduct) return;

    this.addProductToOrder(selectedProduct);
    this.selectedProduct = null;
  }

  // Helper methods for product type
  isService(product: Product): boolean {
    return product.productType === 'SERVICE';
  }

  isProduct(product: Product): boolean {
    return !product.productType || product.productType === 'PRODUCT';
  }

  getProductBadgeKey(product: Product): string {
    return getProductTypeBadgeKey(product);
  }

  getProductBadgeSeverity(product: Product): string {
    return getProductTypeBadgeSeverity(product);
  }

  getProductBadgeIcon(product: Product): string {
    return getProductTypeBadgeIcon(product);
  }

  // Write-off integration helpers
  getAvailableQuantity(product: Product): number {
    return getAvailableQuantity(product);
  }

  getQuantityAlreadyInOrder(product: Product): number {
    const existing = this.targetProducts.find(p => p.productId === product.productId);
    return existing?.orderItemQuantity ?? 0;
  }

  getRemainingAvailableQuantity(product: Product): number {
    if (this.isService(product)) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, this.getAvailableQuantity(product) - this.getQuantityAlreadyInOrder(product));
  }

  canSelectProductForOrder(product: Product): boolean {
    if (!product) {
      return false;
    }
    if (this.isService(product)) {
      return true;
    }
    return this.getRemainingAvailableQuantity(product) > 0;
  }

  getProductUnselectableReason(product: Product): string | null {
    if (this.canSelectProductForOrder(product)) {
      return null;
    }
    if (this.isService(product)) {
      return null;
    }

    const available = this.getAvailableQuantity(product);
    const inOrder = this.getQuantityAlreadyInOrder(product);
    const writeOffQty = this.hasWriteOffs(product) ? this.getWriteOffQuantity(product) : 0;

    if (available <= 0) {
      return writeOffQty > 0
        ? this.translate.instant('product_out_of_stock_writeoffs').replace('{0}', writeOffQty.toString())
        : this.translate.instant('product_out_of_stock');
    }

    if (inOrder > 0 && inOrder >= available) {
      return this.translate.instant('product_max_quantity_in_order', { available });
    }

    return this.translate.instant('insufficient_stock', {
      available: this.getRemainingAvailableQuantity(product),
      required: 1
    });
  }

  notifyProductNotSelectable(product: Product): void {
    this.messageService.add({
      severity: 'warn',
      summary: this.translate.instant('warning'),
      detail: this.getProductUnselectableReason(product) || this.translate.instant('product_quantity_insufficient'),
      life: 4000
    });
  }

  onQuickProductClick(product: Product): void {
    if (!this.canSelectProductForOrder(product)) {
      this.notifyProductNotSelectable(product);
      return;
    }
    this.addProductToOrder(product);
  }

  onCategoryProductClick(product: Product): void {
    if (!this.canSelectProductForOrder(product)) {
      this.notifyProductNotSelectable(product);
      return;
    }
    this.addProductToOrder(product);
  }

  getSelectableCategoryProductsCount(): number {
    return this.filteredProducts.filter(product => this.canSelectProductForOrder(product)).length;
  }

  hasWriteOffs(product: Product): boolean {
    return hasWriteOffs(product);
  }

  getWriteOffQuantity(product: Product): number {
    return getWriteOffQuantity(product);
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

  onVariantProductPicked(product: Product): void {
    this.addProductToOrder(product);
  }

  addProductToOrder(product: Product): void {
    if (!product) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('product_not_found'),
        life: 3000,
      });
      return;
    }

    if (!this.canSelectProductForOrder(product)) {
      this.notifyProductNotSelectable(product);
      return;
    }

    const availableQty = this.getRemainingAvailableQuantity(product);

    const existingProduct = this.targetProducts.find(p => p.productId === product.productId);

    if (!existingProduct) {
      // Get effective price based on customer pricing
      const quantity = product.orderItemQuantity ? product.orderItemQuantity : this.defaultLineQuantity(product);
      const effectivePrice = this.getEffectivePrice(product, quantity);
      
      // Add as new product
      const productToAdd = {
        ...product,
        orderItemQuantity: quantity,
        orderItemPricePerUnit: effectivePrice
      };

      this.targetProducts = [...this.targetProducts, productToAdd];
      void this.loadOptionSetsForLine(productToAdd);

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('product_added_success'),
        life: 3000,
      });

    } else {
      if (this.isProduct(product)) {
        const availableQty = this.getAvailableQuantity(product);
        if (existingProduct.orderItemQuantity < availableQty) {
          existingProduct.orderItemQuantity += this.quantityInputStep(existingProduct);
          // Recalculate price when quantity changes (if not manually overridden)
          if (!existingProduct['orderItemPricePerUnitManual']) {
            // Use async method to get price for new quantity
            this.updateProductPriceForQuantity(existingProduct);
          }
          this.targetProducts = [...this.targetProducts];

          this.messageService.add({
            severity: 'info',
            summary: this.translate.instant('info'),
            detail: this.translate.instant('product_quantity_increased'),
            life: 3000,
          });
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('max_quantity_reached'),
            life: 3000,
          });
        }
      } else {
        // For services, just increase quantity without stock check
        existingProduct.orderItemQuantity += this.quantityInputStep(existingProduct);
        // Recalculate price when quantity changes (if not manually overridden)
        if (!existingProduct['orderItemPricePerUnitManual']) {
          // Use async method to get price for new quantity
          this.updateProductPriceForQuantity(existingProduct);
        }
        this.targetProducts = [...this.targetProducts];

        this.messageService.add({
          severity: 'info',
          summary: this.translate.instant('info'),
          detail: this.translate.instant('product_quantity_increased'),
          life: 3000,
        });
      }
    }

    this.orderItems = this.convertProductsToOrderItems(this.targetProducts);
    this.calculateTotalAmount();
    this.scheduleSyncCheckoutReservations();
    this.cdr.detectChanges();
  }


  removeProductFromOrder(product: Product): void {
    this.targetProducts = this.targetProducts.filter(p => p.productId !== product.productId);

    // Convert to OrderItem for orderItems array
    this.orderItems = this.convertProductsToOrderItems(this.targetProducts);

    this.calculateTotalAmount();
    this.scheduleSyncCheckoutReservations();
    this.cdr.detectChanges();
  }

  private convertProductsToOrderItems(products: Product[]): OrderItem[] {
    return products.map(product => {
      const orderItem: OrderItem = {
        product: {
          productId: product.productId,
          name: product.name,
          description: product.description,
          buyingPrice: product.buyingPrice,
          sellingPrice: product.sellingPrice,
          quantityAvailable: product.quantityAvailable,
          productImage: product.productImage,
          category: product.category
        },
        quantity: product.orderItemQuantity || 0,
        pricePerUnit: this.getOrderItemPricePerUnitForPayload(product) ?? 0,
        subTotal: (product.orderItemQuantity || 0) * (product.orderItemPricePerUnit || 0)
      };
      return orderItem;
    });
  }

  onOrderPriceChange(product: Product): void {
    // Only allow manual override if price override is enabled
    if (this.priceOverrideAllowed) {
      product['orderItemPricePerUnitManual'] = true;
      this.updateProductSubtotal(product);
    } else {
      // If override is disabled, revert to customer pricing or default
      product['orderItemPricePerUnitManual'] = false;
      const quantity = product.orderItemQuantity || this.defaultLineQuantity(product);
      product.orderItemPricePerUnit = this.getEffectivePrice(product, quantity);
      this.updateProductSubtotal(product);
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('price_overrides_disabled'),
        life: 3000
      });
    }
  }

  onOrderQuantityChange(product: Product): void {
    // Recalculate price if quantity changed and price wasn't manually overridden
    if (!product['orderItemPricePerUnitManual']) {
      // Use async method to get price for new quantity
      this.updateProductPriceForQuantity(product);
    }
    this.updateProductSubtotal(product);
    this.scheduleSyncCheckoutReservations();
  }

  /**
   * Update product price based on current quantity using customer pricing API
   */
  async updateProductPriceForQuantity(product: Product): Promise<void> {
    if (!product.productId) return;

    // The pricing API resolves per storage-unit quantity (an int, like order-save does). For
    // fractional/weight products the line holds a display value (e.g. 0.013 kg), so convert to
    // storage units before calling — otherwise the backend rejects the fractional int param (400).
    const displayQty = (product.orderItemQuantity ?? this.defaultLineQuantity(product)) as number;
    const quantity = QuantityScale.isFractional(product)
      ? QuantityScale.toStorageQuantity(product, displayQty)
      : displayQty;

    // If customer pricing is available, try to get price for this quantity
    if (this.order.customer?.customerId) {
      const pricingResult = await this.getProductPriceForQuantity(product.productId, quantity);
      if (pricingResult !== null) {
        product.orderItemPricePerUnit = pricingResult.price;
        
        // Update price source in customerPricing so the badge shows correctly
        if (this.customerPricing) {
          if (!this.customerPricing.priceSources) {
            this.customerPricing.priceSources = {};
          }
          this.customerPricing.priceSources[product.productId] = pricingResult.priceSource;
          
          // Also update the price in the prices object
          if (!this.customerPricing.prices) {
            this.customerPricing.prices = {};
          }
          this.customerPricing.prices[product.productId] = pricingResult.price;
        }
        
        this.targetProducts = [...this.targetProducts];
        this.calculateTotalAmount();
        this.cdr.detectChanges();
        return;
      }
    }
    
    // Fallback to current pricing data or default price
    const effectivePrice = this.getEffectivePrice(product, quantity);
    product.orderItemPricePerUnit = effectivePrice;
    
    // Update price source based on whether price differs from standard
    if (this.customerPricing && product.productId) {
      if (!this.customerPricing.priceSources) {
        this.customerPricing.priceSources = {};
      }
      // Check if price matches standard selling price to determine source
      if (product.sellingPrice && Math.abs(effectivePrice - product.sellingPrice) < 0.01) {
        // Price matches standard, mark as DEFAULT
        this.customerPricing.priceSources[product.productId] = 'DEFAULT';
      } else if (this.customerPricing.priceListName) {
        // Price is different from standard and customer has price list, mark as PRICE_LIST
        this.customerPricing.priceSources[product.productId] = 'PRICE_LIST';
      } else {
        // No price list but price is different - could be override or default
        this.customerPricing.priceSources[product.productId] = 'DEFAULT';
      }
    }
    
    this.targetProducts = [...this.targetProducts];
    this.calculateTotalAmount();
    this.cdr.detectChanges();
  }

  updateProductSubtotal(product: Product): void {
    // Validate against net available quantity (excluding write-offs)
    if (this.isProduct(product)) {
      const netAvailable = this.getAvailableQuantity(product);
      
      if (product.orderItemQuantity > netAvailable) {
        const writeOffs = this.hasWriteOffs(product) ? this.getWriteOffQuantity(product) : 0;
        const unitLabel = this.translate.instant(this.getMeasureUnit(product, netAvailable));
        const message = writeOffs > 0
          ? `${product.name}: Only ${this.formatLineQuantity(product, netAvailable)} ${unitLabel} available (${this.formatLineQuantity(product, writeOffs)} ${unitLabel} written off). Requested: ${this.formatLineQuantity(product, product.orderItemQuantity)} ${unitLabel}`
          : `${product.name}: Only ${this.formatLineQuantity(product, netAvailable)} ${unitLabel} available. Requested: ${this.formatLineQuantity(product, product.orderItemQuantity)} ${unitLabel}`;
        
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('insufficient_stock_title'),
          detail: message,
          life: 3000,
        });
        
        // Reset to max available
        product.orderItemQuantity = netAvailable;
      }
    }

    this.targetProducts = [...this.targetProducts];
    this.orderItems = this.convertProductsToOrderItems(this.targetProducts);
    this.calculateTotalAmount();
  }

  private getOrderItemPricePerUnitForPayload(product: Product): number {
    const manual = !!product['orderItemPricePerUnitManual'];
    if (manual) {
      return product['orderItemPricePerUnit'] || 0;
    }
    return 0;
  }



  getSubtotal(): number {
    return this.targetProducts.reduce((total, product) => {
      const quantity = product.orderItemQuantity || 0;
      const price = product.orderItemPricePerUnit || 0;
      return total + (price * quantity);
    }, 0);
  }


  calculateDiscountAmount(): number {
    const subtotal = this.getSubtotal();
    if (this.discountType === 'Percentage') {
      return (subtotal * (this.order.discount || 0)) / 100;
    } else {
      return this.order.discount || 0;
    }
  }



  async onGetProductsCategories() {
    await this.categoryService.getProductsCategories()
      .subscribe({
        next: (response: any) => {
          this.categories = response;
          this.categories.forEach((category: any) => (category.creationDate = new Date(<Date>category.creationDate)));
        },
        error: (err: any) => {
          this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('error_while_getting_categories'), life: 3000 })
          console.log(err)
        },
        complete: () => {
          this.isLoading = false;
        }
      })
  }

  async onGetAllSuppliers() {
    this.supplierService.loadToken();
    await this.supplierService.getSuppliers()
      .subscribe({
        next: (response: any) => {
          this.suppliers = Array.isArray(response) ? response : [];
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_suppliers'),
            life: 3000
          })
          console.log(err)
        },
      })
  }



  getOrderStatusSeverity(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ORDERED': return 'info';
      case 'PROCESSING': return 'warning';
      case 'DELIVERED': return 'success';
      case 'COMPLETED': return 'help';
      case 'CANCELED': return 'danger';
      case 'RETURN_PENDING': return 'warning';
      case 'PARTIAL_RETURN': return 'warning';
      case 'RETURNED': return 'danger';
      default: return 'secondary';
    }
  }
  // getOrderStatusIcon(status: string): string {
  //   switch (status?.toUpperCase()) {
  //     case 'ORDERED': return 'pi pi-shopping-bag';
  //     case 'PROCESSING': return 'pi pi-cog';
  //     case 'DELIVERED': return 'pi pi-truck';
  //     case 'COMPLETED': return 'pi pi-check';
  //     case 'CANCELED': return 'pi pi-times';
  //     case 'RETURN_PENDING': return 'pi pi-undo';
  //     case 'PARTIAL_RETURN': return 'pi pi-exclamation-triangle';
  //     case 'RETURNED': return 'pi pi-ban';
  //     default: return 'pi pi-question';
  //   }
  // }
  getPaymentStatusSeverity(status: string): string {
    return getPaymentStatusSeverity(status);
  }

  getPaymentMethodLabel(paymentMethod: string) {
    return getPaymentMethodLabel(paymentMethod);
  }

  getPaymentStatusIcon(status: string): string {
    switch (status?.toUpperCase()) {
      case 'PAID': return 'pi pi-check';
      case 'PENDING': return 'pi pi-clock';
      case 'FAILED': return 'pi pi-times';
      case 'PARTIAL': return 'pi pi-exclamation-circle';
      default: return 'pi pi-credit-card';
    }
  }

  getPaymentMethodSeverity(method: string): string {
    return getPaymentMethodSeverity(method);
  }

  getActionButtonIcon(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ORDERED': return 'pi pi-cog';
      case 'PROCESSING': return 'pi pi-truck';
      case 'DELIVERED': return 'pi pi-check';
      case 'RETURN_PENDING': return 'pi pi-check';
      default: return 'pi pi-arrow-right';
    }
  }

  getActionButtonSeverity(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ORDERED': return 'warning';
      case 'PROCESSING': return 'info';
      case 'DELIVERED': return 'success';
      case 'RETURN_PENDING': return 'help';
      default: return 'primary';
    }
  }

  isEventActive(event: any): boolean {
    return event.status === this.order?.orderStatus;
  }

  getStatusDescription(status: string): string {
    const descriptions = {
      'PROCESSING': this.translate.instant('order_under_processing'),
      'DELIVERED': this.order?.paymentStatus === 'PAID'
        ? this.translate.instant('order_delivered_tocomplete_text',
          // { date: this.order.expiryDate | date: 'medium' }
        )
        : this.translate.instant('order_payment_required_text'),
      'COMPLETED': this.translate.instant('order_completed_text'),
      'CANCELED': this.translate.instant('order_canceled_text'),
      'PARTIAL_RETURN': this.translate.instant('order_partial_return_text'),
      'RETURNED': this.translate.instant('order_return_text')
    };
    return descriptions[status] || '';
  }

  getOrderSubtotal(): number {
    if (!this.order?.orderItems) return 0;
    return this.order.orderItems.reduce((total, item) =>
      total + (item.quantity * item.pricePerUnit), 0);
  }

  calculateOrderDiscount(): number {
    if (!this.order?.discount) return 0;
    if (this.order.discountType === 'Percentage') {
      return (this.getOrderSubtotal() * this.order.discount) / 100;
    }
    return this.order.discount;
  }

  calculateOrderTax(): number {
    if (!this.order?.taxEnabled || this.isCustomerTaxExempt()) return 0;
    const subtotal = this.getOrderSubtotal();
    const discountAmount = this.calculateOrderDiscount();
    const taxableAmount = subtotal - discountAmount;
    return taxableAmount * this.taxRate;
  }
  exportOrderToPDF(order: any): void {
    // Implement PDF export logic
    console.log('Exporting order to PDF:', order);
  }

  sendOrderByEmail(order: any): void {
    // Implement email sending logic
    console.log('Sending order by email:', order);
  }

  duplicateOrder(order: any): void {
    // Implement order duplication logic
    console.log('Duplicating order:', order);
  }

  refreshOrderDetails(): void {
    // Implement refresh logic
    console.log('Refreshing order details');
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

  defaultLineQuantity(product: Product): number {
    return defaultLineQty(product);
  }

  formatLineQuantity(product: Product, quantity: number | null | undefined): string {
    return formatLineQty(product, quantity);
  }

  getProductStockLabel(product: Product): { quantity: string; unit: string } {
    return formatProductStockLabel(product);
  }

  getMeasureUnit(product: Product, quantity?: number): string {
    const qty = quantity ?? product.orderItemQuantity ?? getAvailableQuantity(product);
    return getLineMeasureUnit(product, qty);
  }

  getOrderItemQty(item: any): number {
    return getOrderItemDisplayQuantity(item);
  }

  getOrderItemReturnedQty(item: any): number {
    return getOrderItemDisplayReturnedQuantity(item);
  }

  getOrderItemRemainingQty(item: any): number {
    return getOrderItemDisplayRemainingQuantity(item);
  }

  formatOrderItemQty(item: any): string {
    return formatLineQty(item?.product, getOrderItemDisplayQuantity(item));
  }

  getOrderItemMeasureUnit(item: any): string {
    return getLineMeasureUnit(item?.product, getOrderItemDisplayQuantity(item));
  }

  getQuantitySeverity(quantity: number): string {
    return getQuantitySeverity(quantity, this.lowStockThreshold);
  }

  async getLowStockThreshold(): Promise<number> {
    let threshold: any;
    try {
      const value = await firstValueFrom(await this.configService.getConfiguration('lowStockThreshold'));

      threshold = (value !== undefined && value !== null)
        ? Number(value.value)
        : 10;
      return threshold;
    } catch (error) {
      console.error('Error fetching low stock threshold:', error);
      threshold = 10; // fallback value
      return threshold;
    }
  }

  displayAttributeValue(attr: any): string {
    if (!attr) return '';
    switch (attr.attributeType) {
      case 'BOOLEAN':
        return attr.booleanValue ? 'Yes' : 'No';
      case 'INTEGER':
        return attr.intValue?.toString() || '';
      case 'DOUBLE':
        return attr.doubleValue?.toFixed(2) || '';
      default:
        return attr.stringValue || '';
    }
  }

  getProfitClass(product: any): string {
    const profit = this.calculateProfit(product);
    return profit >= 0.3 ? 'text-green-500 font-semibold' :
      profit >= 0.1 ? 'text-blue-500' : 'text-orange-500';
  }

  calculateProfit(product: Product): number {
    if (!product.sellingPrice || !product.buyingPrice) return 0;
    return (product.sellingPrice - product.buyingPrice) / product.buyingPrice;
  }

  editProduct(product: Product) {
    if (!this.canEditProduct) return;
    this.selectedProduct = product;
    this.product = { ...product };
    void this.onGetProductsCategories();
    void this.onGetAllSuppliers();
    void this.onGetAllWarehouses();
    this.productDialog = true;
    this.scanning = false;
  }

  openNewProduct(): void {
    if (!this.canAddProduct) return;
    this.product = {};
    void this.onGetProductsCategories();
    void this.onGetAllSuppliers();
    void this.onGetAllWarehouses();
    this.productDialog = true;
    this.scanning = false;
  }

  deleteProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.product = { ...product };
    this.deleteProductDialog = true;
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

  onProductFormSaveSuccess(_savedProduct: Product): void {
    this.productDialog = false;
    this.scanning = true;
    this.submitted = false;
    this.product = {};
    this.selectedProduct = null;
    this.loadProducts();
    void this.onGetQuickProducts();
  }

  onProductFormSaveError(_payload: any): void {
    // Keep dialog open; ProductFormComponent already displays detailed errors.
  }

  onProductFormVisibleChange(visible: boolean): void {
    this.productDialog = visible;
    if (!visible) {
      this.scanning = true;
      this.submitted = false;
    }
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
          this.loadProducts();
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
          this.loadProducts();
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

  async loadBankAccounts() {
    // BANK_ACCOUNTS is PRO+; /api/bank-accounts is refused below it. Checked inside the
    // loader so it cannot race whatever fires it.
    await this.licenseCapabilitiesService.ensureLoaded();
    if (!this.licenseCapabilitiesService.isFeatureEnabled('BANK_ACCOUNTS')) {
      this.bankAccounts = [];
      return;
    }
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
      const shopDefaultAccountId = this.getOrderShopDefaultBankAccountId();
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

  private getOrderShopDefaultBankAccountId(): number | undefined {
    const shop = this.resolveOrderPaymentShop();
    const raw = shop?.defaultBankAccount?.accountId ?? shop?.defaultBankAccountId;
    if (raw == null) {
      return undefined;
    }
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : undefined;
  }

  private resolveOrderPaymentShop(): Shop | undefined {
    const currentShopId = this.toPositiveNumber(this.order?.shop?.shopId);
    if (currentShopId != null) {
      const latest = this.shops.find(shop => this.toPositiveNumber(shop.shopId) === currentShopId);
      if (latest) {
        this.order.shop = latest;
        return latest;
      }
      return this.order.shop;
    }

    if (!this.isAdmin) {
      const userShopId = this.getCurrentUserShopIdFromToken();
      const tokenShop = userShopId != null
        ? this.shops.find(shop => this.toPositiveNumber(shop.shopId) === userShopId)
        : undefined;
      if (tokenShop) {
        this.order.shop = tokenShop;
        return tokenShop;
      }
    }

    if (Array.isArray(this.shops) && this.shops.length === 1) {
      this.order.shop = this.shops[0];
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

  private async prepareBankPaymentContext(): Promise<boolean> {
    if (!this.paymentValidationService.isBankMethod(this.payment.paymentMethod || '')) {
      this.payment.bankAccountId = undefined;
      delete (this.payment as any).bankAccount;
      this.bankAccountNoticeKey = null;
      return true;
    }

    if (!this.canReadBankAccounts && !this.payment.bankAccountId) {
      this.payment.bankAccountId = this.getOrderShopDefaultBankAccountId();
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

    await this.updateBankAccountFieldVisibility();
    return true;
  }
}
