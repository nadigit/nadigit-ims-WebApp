import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnChanges, OnInit, Pipe, PipeTransform, SimpleChanges, ViewChild } from '@angular/core';
import { MessageService, SelectItem, MenuItem, LazyLoadEvent } from 'primeng/api';
import { Table } from 'primeng/table';
import { OrderService } from 'src/app/services/order.service';
import { Product } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';
import { CustomerService } from 'src/app/services/customer.service';
import { Customer } from 'src/app/models/customer';
import { Order } from 'src/app/models/order';
import { OrderItem } from 'src/app/models/orderItem';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Country, State } from 'country-state-city';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Shop } from 'src/app/models/shop';
import { ShopService } from 'src/app/services/shop.service';
import { OrganizationService } from 'src/app/services/organization.service';
import { OrderReturn } from 'src/app/models/orderReturn';
import { Payment } from 'src/app/models/payment';
import { PaymentService } from 'src/app/services/payment.service';
import { CategoryService } from 'src/app/services/category.service';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { getPaymentMethodLabel, getPaymentMethodSeverity, getPaymentStatusSeverity } from 'src/app/shared/payment-utils';
import { getMeasureUnit, getQuantitySeverity } from 'src/app/shared/product-utils';
import { AngularFireStorage } from '@angular/fire/compat/storage';

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

@Component({
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css', '../sales.component.css'],
  providers: [MessageService]
})
export class OrdersComponent implements OnInit, OnChanges, AfterViewInit {

  @ViewChild('pickList') pickList: ElementRef | undefined;

  Ressource: string = 'ORDERS';

  currency: any;

  events: EventItem[];

  orderDialog: boolean = false;

  detailsDialog: boolean = false;

  customerDialog: boolean = false;

  shopDialog: boolean = false;

  orderReturnDialog: boolean = false;

  deleteOrderDialog: boolean = false;

  deleteOrdersDialog: boolean = false;

  invoiceDialog: boolean = false;

  products: Product[] = [];

  customers: Customer[] = [];

  customer: Customer = {};

  shops: Shop[] = [];

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

  expandedRows: { [key: string]: boolean } = {}; // Keep track of expanded rows

  exportColumns!: ExportColumn[];

  countries: any = Country.getAllCountries();

  selectedCountry: any = null;

  states: any = null;

  originalEvents: any[];

  statusDate: any;
  userRoles: any;
  isAdmin: boolean = false;

  selectedItems: any[] = [];  // Selected order items for return

  discountType: 'Amount' | 'Percentage'; // Default type is "amount"

  returnReason: string = '';
  returnNotes: string | null = null;

  orderReturns: OrderReturn[] = [];

  orderPayments: Payment[] = [];

  receiptDialogVisible: boolean = false;

  receiptData: { order: Order; payment: Payment } = { order: {}, payment: {} };

  loadingReceipt: boolean = false;

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

  scanning: boolean = true;

  private latestProductSuggestionToken = 0;

  TaxEnabledOptions: any[] = [];

  taxEnabled: boolean = false;

  taxRate: number = 0.0;

  discountTypeOptions: any;

  organization: any;

  showPaymentSection: boolean = false;

  payment: Payment = {};

  isSavingPayment: boolean = false;

  paymentMethods: any;

  orderReturnsMap: Map<number, OrderReturn[]> = new Map();
  loadingReturns: Set<number> = new Set();

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
  canReadProduct: boolean = false;
  isLoading: boolean = true;
  productDetailDialog: boolean = false;
  lowStockThreshold;
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

  filteredProducts: Product[] = [];
  productSuggestions: Product[] = [];
  productSuggestionsLoading: boolean = false;
  productSearch: string = '';
  selectedProduct: Product | null = null;
  categories: any[] = [];
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

  

  constructor(private messageService: MessageService,
    private orderService: OrderService,
    private productService: ProductService,
    private customerService: CustomerService,
    private paymentService: PaymentService,
    private shopService: ShopService,
    private cdr: ChangeDetectorRef,
    private configService: AppConfigurationService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private categoryService: CategoryService,
    public organizationService: OrganizationService,
    private financialDocService: FinancialDocumentsService,
    private storage: AngularFireStorage,
    
  ) {
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

    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });

    // Set up translation and events
    this.initializeTranslations();

    this.lowStockThreshold = await this.getLowStockThreshold();

    // Load data
    await Promise.all([
      this.onGetAllCustomers(),
      this.onGetAllShops(),
      this.setUserRoles(),
      this.checkPermissions(),
      this.onGetOrganization(),
    ]);

    // Initialize table columns and statuses
    this.initializeTableColumns();
    this.initializeStatuses();


    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

    // Load first page of orders
    await this.loadOrders();
    this.scanning = false;
  }


  onLazyLoad(event: LazyLoadEvent) {
    const extendedEvent: LazyLoadEventExt = {
      ...event,
      globalFilter: this.globalFilter
    };

    this.updateLastLazyLoadEvent(extendedEvent);
    this.loadOrders();
  }


  loadOrders() {
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;

    const page = first! / rows!;
    const size = rows!;
    const direction = sortOrder === -1 ? 'ASC' : 'DESC';
    const filterPayload = filters ? { ...filters } : {};

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
      // Assign the paginated orders
      this.orders = res.page.content.map((o: any) => ({
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
      this.totalRecords = res.totalOrders;
      this.totalAmount = res.totalAmount;
      this.totalPaid = res.totalPaid;
      this.remainingBalance = res.remainingBalance;

      // Load returns if any
      for (let order of this.orders) {
        if (this.hasReturns(order)) {
          this.loadOrderReturns(order);
        }
      }

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


  private updateLastLazyLoadEvent(event: LazyLoadEvent) {
    this.lastLazyLoadEvent = {
      first: event.first ?? this.lastLazyLoadEvent.first,
      rows: event.rows ?? this.lastLazyLoadEvent.rows,
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
  }

  private initializeTableColumns() {
    this.cols = [
      { field: 'orderId', header: this.translateService.instant('order_id') },
      { field: 'orderStatus', header: this.translateService.instant('order_status') },
      { field: 'Customer', header: this.translateService.instant('order_customer') },
      { field: 'orderDate', header: this.translateService.instant('order_ordered_on') },
      { field: 'deliveryDate', header: this.translateService.instant('order_delivered_on') },
      { field: 'completeDate', header: this.translateService.instant('order_completed_on') },
      { field: 'totalAmount', header: this.translateService.instant('order_total_amount') },
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
    this.statuses = [
      { label: 'Ordered', value: 'Ordered' },
      { label: 'Delivered', value: 'Delivered' },
      { label: 'Canceled', value: 'Canceled' },
      { label: 'Return_Pending', value: 'Return_Pending' },
      { label: 'Returned', value: 'Returned' },
      { label: 'Partial_Return', value: 'Partial_Return' },
      { label: 'Processing', value: 'Processing' },
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


  togglePaymentSection(): void {
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
    }
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
    this.canAddPayment = this.permissionService.canCreate('PAYMENTS');
    this.canAddProduct = this.permissionService.canCreate('PRODUCTS');
    this.canEditProduct = this.permissionService.canUpdate('PRODUCTS');
    this.canDeleteProduct = this.permissionService.canDelete('PRODUCTS');
    this.canReadProduct = this.permissionService.canRead('PRODUCTS');
  }

  async loadTaxRate() {
    (await this.configService.getConfiguration("tax")).subscribe((response: any) => {
      this.taxRate = response.value;
      console.log("tax:" + this.taxRate)
    });
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
        product.quantityAvailable > 0 &&
        !this.order.orderItems.some(targetProduct => targetProduct.product.productId === product.productId)
      );
    } else {
      return this.products.filter(product => product.quantityAvailable > 0);
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

  openShopDialog() {
    if (!this.canAddShop) return;
    this.shop = {};
    this.shopDialog = true;
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

  async editOrder(order: Order) {
    this.scanning = false;
    if (!this.canEditOrder) return;
    this.order = { ...order };
    this.onGetAllCustomers(),
    this.onGetAllShops(),
    this.discountType = this.order.discountType as "Amount" | "Percentage";
    console.log(this.discountType);
    this.orderItems = this.order.orderItems.map(item => {
      return {
        orderItemId: item.orderItemId,
        product: {
          ...item.product,
          orderItemQuantity: item.quantity,
          orderItemPricePerUnit: item.pricePerUnit,
        },
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
      };
    });
    this.showPaymentSection = false;
    await this.onGetProductsCategories();
    this.getSourceProducts();
    this.getTargetProducts();
    this.initializePickList();
    this.initializePaymentMethods();
    await this.onGetQuickProducts();
    this.orderDialog = true;

    // Add the new fields directly to the order object
    this.order.orderItems.forEach(item => {
      item.product.orderItemQuantity = item.quantity;
      item.product.orderItemPricePerUnit = item.pricePerUnit;
    });

    console.log(this.order);
  }


  // Update the remaining quantity after return
  updateRemainingQuantity(item: any) {
    item.remainingQuantity = item.quantity - item.returnedQuantity;

    // Log to see if returnedQuantity is updated
    console.log('Updated returnedQuantity:', item.returnedQuantity);
  }

  updateReturnedQuantity(item: any) {
    // Update the corresponding item in selectedItems with the new returnedQuantity value
    const selectedItem = this.selectedItems.find(si => si.orderItemId === item.orderItemId);
    if (selectedItem) {
      selectedItem.returnedQuantity = item.returnedQuantity;
    }
    // Optionally update remainingQuantity here as well
    this.updateRemainingQuantity(item);
  }

  deleteOrder(order: Order) {
    if (!this.canDeleteOrder) return;
    this.deleteOrderDialog = true;
    this.order = { ...order };
  }

  async confirmDeleteSelected() {
    this.deleteOrdersDialog = false;
    await Promise.all(this.selectedOrders.map(selectedOrder => this.onDeleteOrder(selectedOrder.orderId)));
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('successful'),
      detail: this.translate.instant('orders_deleted'),
      life: 3000
    });
    this.selectedOrders = [];
  }

  async confirmDelete() {
    this.deleteOrderDialog = false;
    await this.onDeleteOrder(this.order.orderId);
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('successful'),
      detail: this.translate.instant('order_deleted'),
      life: 3000
    });
    this.order = {};
  }

  hideDialog() {
    this.orderDialog = false;
    this.showPaymentSection = false;
    this.payment = {};
    this.submitted = false;
  }

  hideCustomerDialog() {
    this.customerDialog = false;
  }
  hideShopDialog() {
    this.shopDialog = false;
  }

  hideDetailsDialog() {
    this.detailsDialog = false;

  }
  hideOrderReturnDialog() {
    this.orderReturnDialog = false;
  }

  async openNew() {
    if (!this.canAddOrder) return;
    this.order = {};
    this.discountType = "Amount";
    this.order.discount = 0;
    this.order.transportAmount = 0;
    this.order.taxEnabled = false;
    await this.onGetProductsCategories();
    this.targetProducts = [];
    this.orderItems = [];
    await this.onGetQuickProducts();
    this.submitted = false;
    this.showPaymentSection = false;
    this.payment = new Payment();
    this.loadProducts();
    this.onGetAllCustomers(),
    this.onGetAllShops(),
    this.initializePaymentMethods();
    this.getSourceProducts(),
    this.getTargetProducts(),
    this.initializePickList();
    this.orderDialog = true;
    this.scanning = true;
  }


  async saveOrder() {
    this.submitted = true;

    if (this.showPaymentSection) {
      const paymentValid = this.validatePayment();
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

    if (this.targetProducts.length === 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('products_required'),
        life: 3000,
      });
      return;
    }

    // Prepare Order Items
    const orderItems: OrderItem[] = this.targetProducts.map((product) => ({
      product,
      quantity: product['orderItemQuantity'],
      pricePerUnit: product['orderItemPricePerUnit'],
    }));

    // Create New Order Object
    const newOrder: Order = {
      ...this.order,
      orderItems,
      taxEnabled: this.taxEnabled,
      discountType: this.discountType,
      discount: this.order.discount,
    };

    // Cleanup temporary fields
    newOrder.orderItems.forEach((orderItem) => {
      delete orderItem.product['orderItemQuantity'];
      delete orderItem.product['orderItemPricePerUnit'];
    });

    try {
      let savedOrder: Order;

      if (newOrder.orderId) {
        savedOrder = await this.updateOrder(newOrder.orderId, newOrder);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('order_updated'),
          life: 3000,
        });
      } else {
        // Now properly awaiting the addOrder promise
        savedOrder = await this.addOrder(newOrder);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('order_added'),
          life: 3000,
        });

        // Only process payment if we have a valid saved order
        if (this.showPaymentSection && savedOrder) {
          console.log('Processing payment for order:', savedOrder);
          await this.processPayment(savedOrder);
        }
      }


      this.orderDialog = false;
      this.resetForms();

    } catch (error) {
      console.error('Error in saveOrder:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_occurred') + ': ' + (error?.message || error),
        life: 3000,
      });
    }
  }

  validatePayment(): boolean {
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

    return true;
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
    else if (this.payment.boeExpirationDate) {
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

    try {

      const paymentResponse = await this.paymentService.savePayment(this.payment).toPromise();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('payment_added'),
        life: 3000,
      });
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
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('receipt_generation_failed'),
        });
      }
    });
    this.resetForms();
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
    this.shopDialog = false;
    this.shop = {};
  }

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
        this.products = res.page.content.map((p: any) => ({
          ...p,
          creationDate: p.creationDate ? new Date(p.creationDate) : null,
          archivedDate: p.archivedDate ? new Date(p.archivedDate) : null,
          buyingDate: p.buyingDate ? new Date(p.buyingDate) : null,
        }));

        this.filteredProducts = this.selectedCategory ? [...this.products] : [];

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
    await this.productService.getQuickProducts()
      .subscribe({
        next: (response: any) => {
          this.quickProducts = response;
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


  async onDeleteOrder(id: any) {
    this.orderService.deleteOrder(id).subscribe({
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

  async addOrder(order: any): Promise<Order> {
    console.log('Saving order:', order);

    return new Promise((resolve, reject) => {
      this.orderService.saveOrder(order).subscribe({
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

  exportPdf() {
    // Clone the suppliers array to avoid modifying the original array
    const modifiedOrders = this.orders.map(order => {
      // Create a copy of the supplier object to modify
      const modifiedOrder = { ...order };
      if (order.customer)
        modifiedOrder['Customer'] = order.customer.firstName + ' ' + order.customer.lastName;

      // Remove the column you want to exclude
      delete modifiedOrder.creationDate;
      delete modifiedOrder.customer;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedSupplier['columnToRemove'];

      return modifiedOrder;
    });

    // Now, export the modified array to PDF
    this.reportingService.exportPdf(this.exportColumns, modifiedOrders, 'orders')
  }

  exportExcel() {
    // Clone the suppliers array to avoid modifying the original array
    const modifiedOrders = this.orders.map(order => {
      // Create a copy of the supplier object to modify
      const modifiedOrder = { ...order };
      if (order.customer)
        modifiedOrder['Customer'] = order.customer.firstName + ' ' + order.customer.lastName;

      // Remove the column you want to exclude
      delete modifiedOrder.creationDate;
      delete modifiedOrder.customer;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedSupplier['columnToRemove'];

      return modifiedOrder;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedOrders, 'orders');
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
    this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);

  }

  async showOrderStatus(order) {
    this.orderReturns = [];
    this.orderPayments = [];
    this.order = { ...order };
    this.images = [];
    await this.onGetOrderPayments(this.order.orderId);
    await this.onGetAllOrderReturn(this.order.orderId);
    console.log(order);

    this.order.orderItems.forEach(item => {
      this.images.push(item.product?.productImage ?? 'assets/core-images/no-image.png');
    });

    // Initialize originalEvents if not already initialized
    if (!this.originalEvents || this.originalEvents.length === 0) {
      this.originalEvents = [...this.events];
    }

    // Find the index of the current status
    const currentStatusIndex = this.originalEvents.findIndex(event => event.status === this.order.orderStatus);

    // Filter events up to the current status
    const filteredEvents = this.originalEvents.slice(0, currentStatusIndex + 1);

    // Conditional filtering based on order status
    switch (this.order.orderStatus) {
      case 'Return_Pending':
      case 'Processing':
        this.events = filteredEvents.filter(
          event => !['Canceled'].includes(event.status)
        );
        break;
      case 'Canceled':
        this.events = filteredEvents.filter(
          event => !['Processing', 'Delivered', 'Completed', 'Return_Pending', 'Returned', 'Partial_Return'].includes(event.status)
        );
        break;
      case 'Delivered':
        this.events = filteredEvents.filter(
          event => !['Canceled'].includes(event.status)
        );
        break;
      case 'Completed':
        this.events = filteredEvents.filter(
          event => !['Partial_Return', 'Returned', 'Return_Pending', 'Canceled'].includes(event.status)
        );
        break;
      case 'Returned':
        this.events = filteredEvents.filter(
          event => !['Partial_Return', 'Canceled'].includes(event.status)
        );
        break;
      case 'Partial_Return':
        this.events = filteredEvents.filter(
          event => !['Returned', 'Canceled'].includes(event.status)
        );
        break;
      default:
        this.events = filteredEvents;
        break;
    }

    this.syncEventDates(this.events);

    this.detailsDialog = true;
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
          product.orderItemQuantity = 1;
        }
      });
    });
    // Force change detection
    this.cdr.detectChanges();
  }

  //function to move scanned products to target
  moveProductToTarget(product: any): void {
    if (product.quantityAvailable <= 0) {
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
        orderItemQuantity: 1
      };
      this.targetProducts.push(newProduct);
      this.sourceProducts = this.sourceProducts.filter(p => p.productId !== product.productId);
      this.orderItems.push(newProduct);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('product_added_success'),
        life: 3000,
      });
      this.cdr.detectChanges();
    } else {
      existingProduct.orderItemQuantity += 1;
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('info'),
        detail: this.translate.instant('product_quantity_increased'),
        life: 3000,
      });
      this.cdr.detectChanges();
    }
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

  calculateTotalAmount(): number {
    const subtotal = this.getSubtotal();
    const discountAmount = this.calculateDiscountAmount();
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = this.calculateTax(taxableAmount);
    const transportAmount = this.order.transportAmount || 0;

    return taxableAmount + taxAmount + transportAmount;
  }


  calculateTax(amount: number): number {
    if (!this.taxEnabled) return 0;
    return amount * this.taxRate; // 0.2 * amount = 20% of amount
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
    return this.sourceProducts.find((p: Product) => p.reference === barcode);
  }

  // Check if a key is a valid alphanumeric character
  isAlphanumeric(key: string): boolean {
    const isAlphaNum = /^[a-zA-Z0-9]$/.test(key);
    return isAlphaNum;
  }

  processBarcode(): void {
    if (this.barcode) {
      const product = this.searchProductByBarcode(this.barcode);
      if (product) {
        console.log("Product found: ", product);
        // Move the product to target using the new method
        // this.moveProductToTarget(product);
        this.addProductToOrder(product);
      } else {
        console.log(`Product does not exist in stock for barcode: ${this.barcode}`);
      }
      this.barcode = ''; // Clear the barcode buffer after processing
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (this.scanning) {
      const key = event.key;

      // If the key is a valid alphanumeric character, add it to the barcode buffer
      if (this.isAlphanumeric(key)) {
        this.barcode += key;
      }

      // If the Enter key is pressed, process the barcode
      if (key === 'Enter') {
        this.processBarcode();
      }

      // Clear any existing timeout
      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout);
      }

      // Set a timeout to process the barcode after 300ms of inactivity
      this.scanTimeout = setTimeout(() => {
        this.processBarcode();
      }, 300);
    }
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

    this.productSuggestionsLoading = true;

    this.productService.searchProductsForOrder(query).subscribe({
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
    const selectedProductIds = new Set(
      this.targetProducts.map(product => product.productId)
    );

    return products.filter(product =>
      (product?.quantityAvailable ?? 0) > 0 &&
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

    if (product.quantityAvailable <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('product_quantity_insufficient'),
        life: 3000,
      });
      return;
    }

    const existingProduct = this.targetProducts.find(p => p.productId === product.productId);

    if (!existingProduct) {
      // Add as new product
      const productToAdd = {
        ...product,
        orderItemQuantity: product.orderItemQuantity ? product.orderItemQuantity : 1,
        orderItemPricePerUnit: product.orderItemPricePerUnit ? product.orderItemPricePerUnit : product.sellingPrice
      };

      this.targetProducts = [...this.targetProducts, productToAdd];

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('product_added_success'),
        life: 3000,
      });

    } else {
      // Check stock before increasing quantity
      if (existingProduct.orderItemQuantity < product.quantityAvailable) {
        existingProduct.orderItemQuantity += 1;
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
    }

    this.orderItems = this.convertProductsToOrderItems(this.targetProducts);
    this.calculateTotalAmount();
    this.cdr.detectChanges();
  }


  removeProductFromOrder(product: Product): void {
    this.targetProducts = this.targetProducts.filter(p => p.productId !== product.productId);

    // Convert to OrderItem for orderItems array
    this.orderItems = this.convertProductsToOrderItems(this.targetProducts);

    this.calculateTotalAmount();
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
        pricePerUnit: product.orderItemPricePerUnit || 0,
        subTotal: (product.orderItemQuantity || 0) * (product.orderItemPricePerUnit || 0)
      };
      return orderItem;
    });
  }

  updateProductSubtotal(product: Product): void {
    if (product.orderItemQuantity > product.quantityAvailable) {
      product.orderItemQuantity = product.quantityAvailable;
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('max_quantity_reached'),
        life: 3000,
      });
    }

    this.targetProducts = [...this.targetProducts];
    this.orderItems = this.convertProductsToOrderItems(this.targetProducts);
    this.calculateTotalAmount();
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
    if (!this.order?.taxEnabled) return 0;
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
    this.selectedProduct = product;
    this.productDetailDialog = true;
  }

  getMeasureUnit(product: Product): string {
    return getMeasureUnit(product.measureUnit, product.quantityAvailable);
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
    this.productDialog = true;
    this.scanning = false;
  }

  async onFileUpload(event: any): Promise<void> {
    const file = event.files[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_image_format'),
        life: 3000,
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5000000) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('image_too_large'),
        life: 3000,
      });
      return;
    }

    // Show loading state
    this.isImageLoading = true;

    // Create preview
    this.imagePreviewUrl = URL.createObjectURL(file);

    // Store the file for upload
    this.uploadedFile = file;

    // Auto-hide loading after a brief moment (image load event will handle it)
    setTimeout(() => {
      if (this.isImageLoading) this.isImageLoading = false;
    }, 2000);
  }

  // Drag and drop handlers
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];

      // Create a mock event object for the fileUpload method
      this.onFileUpload({ files: [file] });
    }
  }

  // Image error handler
  onImageError(): void {
    this.isImageLoading = false;
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('error'),
      detail: this.translate.instant('image_load_error'),
      life: 3000,
    });

    // Fallback to default image
    this.imagePreviewUrl = null;
    this.product.productImage = 'assets/core-images/no-image.png';
  }

  // Zoom image
  zoomImage(): void {
    this.imageZoomDialog = true;
  }

  // Select recent image
  selectRecentImage(imageUrl: string): void {
    this.product.productImage = imageUrl;
    this.imagePreviewUrl = null;
    this.uploadedFile = null;
  }

  // Enhanced editImage method
  editImage(): void {
    this.product.productImage = null;
    this.imagePreviewUrl = null;
    this.uploadedFile = null;
  }

  // Enhanced removeImage method
  removeImage(): void {
    this.product.productImage = null;
    this.imagePreviewUrl = null;
    this.uploadedFile = null;
  }

  deleteProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.deleteProductDialog = true;
    this.product = { ...product };
  }

  async confirmProductDelete() {
    if (!this.canDeleteProduct) return;
    this.deleteProductDialog = false;
    await this.onDeleteProduct(this.product.productId);
    this.product = {};
  }

  hideProductDialog() {
    this.productDialog = false;
    this.scanning = true;
    this.submitted = false;
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
    if (!this.canDeleteProduct) return;
    this.archiveProductDialog = true;
    this.product = { ...product };
    this.productDialog = false;
  }

  async confirmArchive() {
    if (!this.canDeleteProduct) return;
    this.archiveProductDialog = false;
    await this.onArchiveProduct(this.product.productId);
    this.product = {};
    this.selectedProduct = {};
  }

    async saveProduct() {
      this.submitted = true;
  
      if (
        this.product.name &&
        this.product.reference &&
        this.product.buyingPrice &&
        this.product.sellingPrice &&
        this.product.category &&
        this.product.supplier
      ) {
        if (this.isAdmin && !this.product.warehouse) {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('warehouse_required'),
            life: 3000,
          });
          return;
        }
  
        // 🔍 Check for duplicate product with same reference in the same warehouse
        const isDuplicate = this.products.some(p =>
          p.reference === this.product.reference &&
          p.warehouse?.warehouseId === this.product.warehouse?.warehouseId &&
          p.productId !== this.product.productId // exclude current product if updating
        );
  
        if (isDuplicate) {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('product_already_exists_in_warehouse'),
            life: 4000,
          });
          return;
        }
  
        // 📦 Upload product image if any (only if it's a new file)
        if (this.uploadedFile && this.uploadedFile !== this.existingImageFile) {
          this.isSaving = true; // Show saving indicator
  
          try {
            const filePath = `images/${Date.now()}_${this.uploadedFile.name}`;
            const fileRef = this.storage.ref(filePath);
            const task = this.storage.upload(filePath, this.uploadedFile);
  
            // Show upload progress
            task.percentageChanges().subscribe(percentage => {
              this.uploadProgress = percentage;
            });
  
            await lastValueFrom(task.snapshotChanges());
            const url = await lastValueFrom(fileRef.getDownloadURL());
            this.product.productImage = url;
  
            // Add to recent images
            this.addToRecentImages(url);
  
          } catch (error) {
            console.error('Error uploading file:', error);
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: this.translate.instant('error_while_uploading_image'),
              life: 3000,
            });
            this.isSaving = false;
            return;
          } finally {
            this.uploadedFile = null;
            this.uploadProgress = 0;
          }
        }
  
        // Clean attributes before saving
        if (this.product.attributes && this.product.attributes.length > 0) {
          this.product.attributes.forEach(attr => {
            // strip transient field if it still exists
            delete attr.value;
  
            // optionally normalize booleans (Angular checkboxes can send null)
            if (attr.attributeType === 'BOOLEAN' && attr.booleanValue == null) {
              attr.booleanValue = false;
            }
          });
        }
  
        // ✏️ Update or add product
        if (this.product.productId) {
          this.updateProduct(this.product.productId, this.product)
            ? this.messageService.add({
              severity: 'success',
              summary: this.translate.instant('successful'),
              detail: this.translate.instant('product_updated'),
              life: 3000,
            })
            : this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: this.translate.instant('error_while_updating_product'),
              life: 3000,
            });
        } else {
          this.addProduct(this.product);
        }
  
        // ✅ Reset and close dialog
        this.productDialog = false;
        this.product = {};
      } else {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('please_fill_required_fields'),
          life: 3100,
        });
        return;
      }
    }

      addToRecentImages(imageUrl: string): void {
    // Keep only the 6 most recent images
    this.recentProductImages = [imageUrl, ...this.recentProductImages].slice(0, 6);

    // You might want to persist this to local storage
    localStorage.setItem('recentProductImages', JSON.stringify(this.recentProductImages));
  }

    async updateProduct(id: any, product: any): Promise<any> {
    console.log(product)
    await this.productService.updateProduct(id, product)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.loadProducts();
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_product'),
            life: 3000
          });
          console.log(err);
          return false;
        },
      })
  }

  async addProduct(data: any): Promise<any> {
    console.log(data);
    await this.productService.saveProduct(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.loadProducts();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_added'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_product'),
            life: 3000
          });
          console.log(err);
          return false;
        },
      })
  }
}
