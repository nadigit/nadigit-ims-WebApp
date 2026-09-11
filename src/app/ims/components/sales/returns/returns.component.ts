import { ChangeDetectorRef, Component, ElementRef, HostListener, OnChanges, OnDestroy, OnInit, Pipe, PipeTransform, SimpleChanges, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService, SelectItem, MenuItem, LazyLoadEvent } from 'primeng/api';
import { Table } from 'primeng/table';
import { DataView } from 'primeng/dataview';
import { OrderService } from 'src/app/services/order.service';
import { Product } from 'src/app/models/product';
import { Order } from 'src/app/models/order';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { OrderReturn } from 'src/app/models/orderReturn';
import { ReturnItem } from 'src/app/models/returnItem';
import { ReturnService } from 'src/app/services/return.service';
import { BarcodeService } from 'src/app/services/barcode.service';
import { ReturnStatus } from 'src/app/enums/return-status.enum';
import { OrderItem } from 'src/app/models/orderItem';
import { Customer } from 'src/app/models/customer';
import { CustomerService } from 'src/app/services/customer.service';
import { Refund } from 'src/app/models/refund';
import { firstValueFrom, Subscription } from 'rxjs';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { DatePipe } from '@angular/common';
import { ShopService } from 'src/app/services/shop.service';
import { Shop } from 'src/app/models/shop';
import {
  initTablePageSizeState,
  persistTablePageSizeFromLazyEvent,
  TablePageSizeKeys,
} from 'src/app/utils/table-page-size.storage';
import { QuantityScale } from 'src/app/utils/quantity-scale.util';
import {
  defaultLineQuantity,
  formatLineQuantity as formatLineQty,
  getLineMeasureUnit,
  getOrderItemDisplayQuantity,
  getOrderItemDisplayRemainingQuantity,
  lineQuantityDecimals,
  lineQuantityMin as lineQtyMin,
  lineQuantityStep,
} from 'src/app/shared/product-utils';


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
  templateUrl: './returns.component.html',
  styleUrls: ['./returns.component.css', '../sales.component.css'],
  providers: [MessageService, DatePipe]
})
export class ReturnsComponent implements OnInit, OnChanges, OnDestroy {

  Ressource: string = 'RETURNS';

  currency: any;

  returnDialog: boolean = false;

  detailsDialog: boolean = false;

  deleteReturnDialog: boolean = false;

  cancelReturnDialog: boolean = false;

  deleteReturnsDialog: boolean = false;

  products: Product[] = [];

  product: Product = {};

  returns: OrderReturn[] = [];

  return: OrderReturn = {};

  orders: Order[] = [];

  selectedProducts: Product[] = [];

  otherTemplate: Product[] = [];

  selectedReturns: OrderReturn[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];
  returnStatuses: any[] = [];
  refundStatuses: any[] = [];

  // Filter properties
  selectedReturnStatus: string | null = null;
  selectedRefundStatus: string | null = null;
  selectedCustomer: Customer | null = null;
  selectedShop: Shop | null = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  globalFilter: string = '';
  
  // Lazy loading properties
  totalRecords: number = 0;
  lastLazyLoadEvent: LazyLoadEvent = {
    first: 0,
    rows: 20,
    sortField: 'returnDate',
    sortOrder: -1
  };
  
  isExporting: boolean = false;
  exportProgress: string = '';
  
  shops: Shop[] = [];

  rowsPerPageOptions = [20, 50, 100];
  pageSize = 20;

  valSwitch: boolean = false;

  sortOptions: SelectItem[] = [];

  sortReturn: number = 0;

  sortField: string = '';

  customers: Customer[] = [];

  customer: Customer = {};

  menuItems: MenuItem[] = [];

  items: MenuItem[] | undefined;

  sourceProducts: Product[] = [];

  targetProducts: Product[] = [];

  selectedReturnProduct: Product | null = null;

  expandedRows: { [key: string]: boolean } = {}; // Keep track of expanded rows

  exportColumns!: ExportColumn[];

  originalEvents: any[];

  statusDate: any;
  userRoles: any;
  isAdmin: boolean = false;

  selectedItems: any[] = [];  // Selected order items for return

  returnReason: string = '';
  returnNotes: string | null = null;

  orderReturns: any;

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

  TaxEnabledOptions: any[] = [];

  taxEnabled: boolean = false;

  taxRate: number = 0.0;

  Math = Math;

  returnReasons: any[];

  itemConditions: any[] = [];
  
  // Return refund percentages from app configuration
  returnRefundPercentages: { [key: string]: number } = {
    'NEW': 1.0,      // Default: 100%
    'USED': 0.8,     // Default: 80%
    'DAMAGED': 0.5   // Default: 50%
  };
  conditionRefundMessages: { [key: string]: string } = {};

  // Permissions
  canAddReturn: boolean = false;
  canEditReturn: boolean = false;
  canDeleteReturn: boolean = false;

  isLoading: boolean = false;

  @ViewChild('filter') filter!: ElementRef;
  canReadReturn: boolean = false;
  canCancelReturn: boolean = false;
  lowStockThreshold: number = 10;

  private configSavedSub?: Subscription;
  
  constructor(private messageService: MessageService,
    private returnService: ReturnService,
    private barcodeService: BarcodeService,
    private orderService: OrderService,
    private customerService: CustomerService,
    private cdr: ChangeDetectorRef,
    private configService: AppConfigurationService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private financialDocService: FinancialDocumentsService,
    public keycloakService: KeycloakService,
    private router: Router,
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private shopService: ShopService,
    private datePipe: DatePipe
  ) {
    this.loadTaxRate();
  }

  async ngOnInit() {
    this.isLoading = true;
    initTablePageSizeState(TablePageSizeKeys.returns, this.rowsPerPageOptions, {
      pageSize: this.pageSize,
      lastLazyLoadEvent: this.lastLazyLoadEvent,
    });
    
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });

    this.lowStockThreshold = await this.getLowStockThreshold();
    
    // Load return refund percentages
    await this.loadReturnRefundPercentages();

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
      if (key.startsWith('return.refund.percentage.')) {
        void this.loadReturnRefundPercentages().then(() => this.cdr.markForCheck());
      }
    });

    // Set up translation and events
    this.initializeTranslations();


    // Load data
    await Promise.all([
      this.onGetAllCustomers(),
      this.onGetAllShops(),
      this.setUserRoles(),
      this.checkPermissions(),
    ]);

    // Initialize table columns and statuses
    this.initializeTableColumns();
    this.initializeReturnStatuses();

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

    const qpReturnStatus = this.route.snapshot.queryParamMap.get('returnStatus');
    if (qpReturnStatus) {
      const upper = qpReturnStatus.trim().toUpperCase();
      const normalized = upper === 'CANCELLED' ? 'CANCELED' : upper;
      const allowed = new Set(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELED', 'PARTIALLY_REFUNDED']);
      if (allowed.has(normalized)) {
        this.selectedReturnStatus = normalized;
      }
    }

    if (this.selectedReturnStatus) {
      this.applyFilters();
    } else {
      await this.loadReturns();
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

        this.returnReasons = [
          { label: translations['return_reason_defective'], value: 'DEFECTIVE' },
          { label: translations['return_reason_incorrect_item'], value: 'INCORRECT_ITEM' },
          { label: translations['return_reason_change_of_mind'], value: 'CHANGE_OF_MIND' },
          { label: translations['return_reason_other'], value: 'OTHER' }
        ];

        this.itemConditions = [
          { label: translations['item_condition_new'], value: 'NEW' },
          { label: translations['item_condition_used'], value: 'USED' },
          { label: translations['item_condition_damaged'], value: 'DAMAGED' }
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

  ngOnChanges(changes: SimpleChanges): void {
    if ('return' in changes) {
      this.refreshAvailableReturnProducts();
    }
  }

  ngOnDestroy(): void {
    this.configSavedSub?.unsubscribe();
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddReturn = this.permissionService.canCreate(this.Ressource);
    this.canEditReturn = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteReturn = this.permissionService.canDelete(this.Ressource);
    this.canReadReturn = this.permissionService.canRead(this.Ressource);
    this.canCancelReturn = this.permissionService.canCancel(this.Ressource);
  }

  async loadTaxRate() {
    (await this.configService.getConfiguration("tax")).subscribe((response: any) => {
      this.taxRate = response.value;
      console.log("tax:" + this.taxRate)
    });
  }

  toggleRow(returnID: string): void {
    this.expandedRows[returnID] = !this.expandedRows[returnID];
  }

  isRowExpanded(returnID: string): boolean {
    return this.expandedRows[returnID] === true;
  }

  hideDialog() {
    this.returnDialog = false;
    this.submitted = false;
    this.scanning = false;
    this.resetBarcodeBuffer();
  }

  initializePickList(): void {
    this.refreshAvailableReturnProducts();
  }

  refreshAvailableReturnProducts(): void {
    this.sourceProducts = this.getAvailableOrderProducts();
  }

  onReturnOrderChange(): void {
    this.targetProducts = [];
    this.selectedReturnProduct = null;
    this.refreshAvailableReturnProducts();
  }

  getAvailableOrderProducts(): Product[] {
    if (!this.return?.order?.orderItems?.length) {
      return [];
    }

    const selectedIds = new Set(this.targetProducts.map(product => product.productId));
    return this.return.order.orderItems
      .filter(orderItem => orderItem.product?.productId && !selectedIds.has(orderItem.product.productId))
      .map(orderItem => this.mapOrderItemToReturnProduct(orderItem));
  }

  mapOrderItemToReturnProduct(orderItem: OrderItem): Product {
    const product = { ...orderItem.product } as Product;
    product.orderItem = orderItem;
    product.orderItemPricePerUnit = orderItem.pricePerUnit;
    return product;
  }

  onReturnProductSelect(event: { value?: Product | null }): void {
    const product = event?.value;
    if (!product?.productId) {
      return;
    }
    this.addProductToReturn(product);
    this.selectedReturnProduct = null;
  }

  addProductToReturn(product: Product): void {
    if (this.getReturnMaxQuantity(product) <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('insufficient_quantity'),
        detail: this.translate.instant('product_quantity_not_sufficient_to_move'),
        life: 3000,
      });
      return;
    }

    const existingProduct = this.targetProducts.find(item => item.productId === product.productId);
    if (existingProduct) {
      existingProduct.returnItemQuantity = (existingProduct.returnItemQuantity || 0) + lineQuantityStep(existingProduct);
      this.cdr.detectChanges();
      return;
    }

    const orderItem = product.orderItem || this.findOrderItemForProduct(product);
    if (!orderItem) {
      console.error('Original order item not found for product:', product);
      return;
    }

    const unitPrice = orderItem.pricePerUnit ?? product.orderItemPricePerUnit ?? product.sellingPrice;
    this.targetProducts.push({
      ...product,
      orderItem,
      orderItemPricePerUnit: unitPrice,
      returnItemPricePerUnit: unitPrice,
      returnItemQuantity: defaultLineQuantity(product),
      returnItemCondition: 'NEW',
      returnItemReason: 'INCORRECT_ITEM',
    });
    this.refreshAvailableReturnProducts();
    this.cdr.detectChanges();
  }

  removeProductFromReturn(product: Product): void {
    this.targetProducts = this.targetProducts.filter(item => item.productId !== product.productId);
    this.refreshAvailableReturnProducts();
    this.cdr.detectChanges();
  }

  getReturnLineSubtotal(product: Product): number {
    return (product.returnItemQuantity || 0) * (product.returnItemPricePerUnit || 0);
  }

  getSourceProducts(): Product[] {
    return this.getAvailableOrderProducts();
  }

  getTargetProducts(): Product[] {
    if (this.return && this.return.returnItems && this.return.returnItems.length > 0) {
      return this.return.returnItems.map(element => element.product);
    }
    return [];
  }

  getOrderDisplayLabel = (order: any): string => {
    if (!order) return '';

    const reference = order.reference || 'N/A';
    const totalAmount = order.totalAmount;
    const itemCount = order.itemCount !== undefined ? order.itemCount : this.getSafeItemsCount(order);
    const customerName = this.getCustomerDisplayName(order.customer);

    return `#${reference} • ${totalAmount} • ${itemCount} ${this.translate.instant('items')} • ${customerName}`;
  }


  getSafeItemsCount(order: any): number {
    // Safest possible item count implementation
    try {
      if (!order) return 0;
      if (!order.orderItems) return 0;
      if (!Array.isArray(order.orderItems)) return 0;
      return order.orderItems.length;
    } catch (e) {
      console.warn('Error counting order items:', e);
      return 0;
    }
  }


  getCustomerDisplayName(customer: any): string {
    if (!customer) return this.translate.instant('no_customer');

    if (customer.customerType === 'Company') {
      return customer.companyName || this.translate.instant('unnamed_company');
    }

    const firstName = customer.firstName || '';
    const lastName = customer.lastName || '';
    return firstName || lastName ?
      `${firstName} ${lastName}`.trim() :
      this.translate.instant('unnamed_customer');
  }


  deleteSelectedReturns() {
    if (!this.canDeleteReturn) return;
    this.deleteReturnsDialog = true;
  }

  editReturn(orderReturn: OrderReturn) {
    if (!this.canEditReturn) return;

    this.return = { ...orderReturn };
    this.targetProducts = (this.return.returnItems || []).map(item => {
      const orderItem = item.orderItem || this.findOrderItemForProduct(item.product);
      const displayQty = QuantityScale.toDisplayQuantity(item.product, item.returnedQuantity ?? 0);
      const unitPrice = item.refundAmount ?? orderItem?.pricePerUnit ?? item.product.sellingPrice;
      return {
        ...item.product,
        orderItem,
        orderItemPricePerUnit: orderItem?.pricePerUnit,
        returnItemQuantity: displayQty,
        returnItemPricePerUnit: unitPrice,
        returnItemCondition: item.condition || 'NEW',
        returnItemReason: item.reason || 'INCORRECT_ITEM',
      } as Product;
    });

    this.returnDialog = true;
    this.scanning = true;
    this.selectedReturnProduct = null;
    this.refreshAvailableReturnProducts();
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

  deleteReturn(orderReturn: OrderReturn) {
    if (!this.canDeleteReturn) return;
    this.deleteReturnDialog = true;
    this.return = { ...orderReturn };
  }

  cancelReturn(orderReturn: OrderReturn) {
    if (!this.canProcessRefund) return;
    this.cancelReturnDialog = true;
    this.return = { ...orderReturn };
  }

  confirmDeleteSelected(force: boolean = false) {
    this.deleteReturnsDialog = false;
    this.selectedReturns.forEach(selectedReturn => this.onDeleteReturn(selectedReturn.returnId, force));
    this.selectedReturns = [];
  }

  async confirmDelete(returnId?: number, force: boolean = false) {
    this.deleteReturnDialog = false;
    await this.onDeleteReturn(returnId ?? this.return.returnId, force);
    this.return = {};
  }

  async confirmCancelReturn(){
    this.cancelReturnDialog = false;
    await this.onCancelReturn(this.return.returnId);
    this.return = {};
  }

  hideDetailsDialog() {
    this.detailsDialog = false;

  }

  openNew() {
    if (!this.canAddReturn) return;
    this.return = {};
    this.targetProducts = [];
    this.selectedReturnProduct = null;
    this.return.returnDate = new Date();
    this.submitted = false;
    this.onGetAllOrders();
    this.refreshAvailableReturnProducts();
    this.returnDialog = true;
    this.scanning = true;
  }

  private findOrderItemForProduct(product: Product): OrderItem | undefined {
    return this.return.order?.orderItems?.find(
      item => item.product.productId === product.productId
    );
  }

  async saveReturn() {
    console.log(this.return)
    this.submitted = true;

    // Check Product Selection
    if (this.targetProducts.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('no_items_returned'),
        detail: this.translate.instant('at_least_one_product_must_be_selected'),
        life: 3000,
      });
      return;
    }

    // Validate all products have OrderItem references
    const productsWithoutOrderItem = this.targetProducts.filter(
      p => !p.orderItem
    );

    if (productsWithoutOrderItem.length > 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('invalid_products'),
        detail: this.translate.instant('some_products_missing_order_references'),
        life: 3000,
      });
      return;
    }

    if (this.return.returnDate) {
      // Ensure `dateOfExpense` is a Date object
      const date =
        typeof this.return.returnDate === "string"
          ? new Date(this.return.returnDate)
          : this.return.returnDate;

      // Format the date into YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
      const day = String(date.getDate()).padStart(2, "0");

      this.return.returnDate = `${year}-${month}-${day}`; // Convert to string format
    }

    // Prepare Order Items
    const returnItems: ReturnItem[] = this.targetProducts.map((product) => {
      const baseRefund = product.returnItemPricePerUnit * product.returnItemQuantity;
      const condition = product.returnItemCondition || 'NEW';
      // Apply refund percentage based on condition
      const refundPercentage = this.getRefundPercentage(condition);
      const refundAmount = baseRefund * refundPercentage;
      
      const displayQty = product.returnItemQuantity ?? 0;
      const storageQty = QuantityScale.isFractional(product)
        ? QuantityScale.toStorageQuantity(product, displayQty)
        : Math.max(1, Math.round(displayQty));
      return {
        product: product,
        returnedQuantity: storageQty,
        refundAmount: refundAmount,
        condition: condition,
        orderItem: product.orderItem,
        reason: product.returnItemReason || 'INCORRECT_ITEM', // Default to 'INCORRECT_ITEM' if not specified
      } as ReturnItem;
    });

    console.log(returnItems)
    // Create New Order Object
    const newOrderReturn: OrderReturn = {
      ...this.return,
      returnItems,
    };

    console.log(newOrderReturn)

    // Cleanup: Remove temporary fields from products
    newOrderReturn.returnItems.forEach((orderItem) => {
      delete orderItem.product['returnItemQuantity'];
      delete orderItem.product['returnItemPricePerUnit'];
      delete orderItem.product['orderItem']
      delete orderItem.product['returnItemCondition'];
      delete orderItem.product['returnItemReason'];
    });

    try {
      if (newOrderReturn.returnId) {
        await this.updateReturn(newOrderReturn.returnId, newOrderReturn);
        return;
      } else {
        await this.addReturn(newOrderReturn);
      }
    } catch (error) {
      console.error('Return creation failed:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('failed_to_process_return') + (error.message ? `: ${error.message}` : ''),
        life: 3000,
      });
    }

    this.returns = [...this.returns];
    this.returnDialog = false;
    this.scanning = false;
    this.resetBarcodeBuffer();
    this.return = {};
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

  private initializeReturnStatuses() {
    // Return statuses based on backend enum: PENDING, PROCESSING, COMPLETED, CANCELLED
    this.returnStatuses = [
      { label: 'Pending', value: 'PENDING' },
      { label: 'Processing', value: 'PROCESSING' },
      { label: 'Completed', value: 'COMPLETED' },
      { label: 'Canceled', value: 'CANCELED' },
    ];
    
    // Refund statuses based on backend enum: UNREFUNDED, PARTIALLY_REFUNDED, REFUNDED
    if (!this.refundStatuses || this.refundStatuses.length === 0) {
      this.refundStatuses = [
        { label: 'refund_status_unrefunded', value: 'UNREFUNDED' },
        { label: 'refund_status_partially_refunded', value: 'PARTIALLY_REFUNDED' },
        { label: 'refund_status_refunded', value: 'REFUNDED' },
      ];
    }
  }

  applyFilters() {
    // Build filters object in the format expected by the service
    // Service expects: { field: { value: ..., matchMode: ... } }
    const filters: any = {};
    
    if (this.selectedReturnStatus) {
      filters.returnStatus = { value: this.selectedReturnStatus, matchMode: 'equals' };
    }
    if (this.selectedRefundStatus) {
      filters.refundStatus = { value: this.selectedRefundStatus, matchMode: 'equals' };
    }
    if (this.selectedCustomer) {
      // Pass the full customer object - the service will extract customerId from it
      filters.customerId = { value: this.selectedCustomer, matchMode: 'equals' };
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

    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      filters: filters
    };

    this.updateLastLazyLoadEvent(lazyEvent);
    this.loadReturns();
  }

  onFilterChange() {
    // Apply filters immediately when filter values change
    this.applyFilters();
  }

  clearFilters() {
    this.selectedReturnStatus = null;
    this.selectedRefundStatus = null;
    this.selectedCustomer = null;
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

  onFilter(dv: DataView, event: Event) {
    dv.filter((event.target as HTMLInputElement).value);
  }

  clear(table: Table) {
    table.clear();
  }


  /**
   * Load return refund percentages from app configuration
   */
  async loadReturnRefundPercentages() {
    try {
      const configKeys = [
        'return.refund.percentage.new',
        'return.refund.percentage.used',
        'return.refund.percentage.damaged'
      ];

      for (const key of configKeys) {
        try {
          const value$ = await this.configService.getConfigurationValue(key);
          const value = await firstValueFrom(value$);
          const percentage = parseFloat(value) || this.getDefaultPercentage(key);
          
          // Map config key to condition
          if (key.includes('new')) {
            this.returnRefundPercentages['NEW'] = percentage;
          } else if (key.includes('used')) {
            this.returnRefundPercentages['USED'] = percentage;
          } else if (key.includes('damaged')) {
            this.returnRefundPercentages['DAMAGED'] = percentage;
          }
        } catch (error) {
          console.warn(`Failed to load config ${key}, using default:`, error);
          // Use default value
        }
      }

      // Generate messages for each condition
      this.generateConditionRefundMessages();
    } catch (error) {
      console.error('Error loading return refund percentages:', error);
      // Use default values
      this.generateConditionRefundMessages();
    }
  }

  /**
   * Get default percentage for a config key
   */
  private getDefaultPercentage(key: string): number {
    if (key.includes('new')) return 1.0;
    if (key.includes('used')) return 0.8;
    if (key.includes('damaged')) return 0.5;
    return 1.0;
  }

  /**
   * Generate refund messages for each condition
   */
  private generateConditionRefundMessages() {
    const conditions = ['NEW', 'USED', 'DAMAGED'];
    conditions.forEach(condition => {
      const percentage = this.returnRefundPercentages[condition] || 1.0;
      const percentageDisplay = Math.round(percentage * 100);
      const conditionName = this.translate.instant('item_condition_' + condition.toLowerCase());
      
      if (percentage === 1.0) {
        this.conditionRefundMessages[condition] = 
          this.translate.instant('return_condition_full_refund_message', {
            condition: conditionName,
            percentage: percentageDisplay
          });
      } else {
        this.conditionRefundMessages[condition] = 
          this.translate.instant('return_condition_reduced_refund_message', {
            condition: conditionName,
            percentage: percentageDisplay
          });
      }
    });
  }

  /**
   * Get refund percentage for a condition
   */
  getRefundPercentage(condition: string): number {
    return this.returnRefundPercentages[condition] || 1.0;
  }

  /**
   * Get refund message for a condition
   */
  getConditionRefundMessage(condition: string): string {
    return this.conditionRefundMessages[condition] || '';
  }

  /**
   * Handle condition change - update refund amount and show message
   */
  onConditionChange(product: any) {
    // Recalculate refund with new condition
    if (product.returnItemPricePerUnit && product.returnItemQuantity) {
      // Get the original price per unit (before condition adjustment)
      // We need to reverse the percentage to get the base price
      const currentCondition = product.returnItemCondition || 'NEW';
      const currentPercentage = this.getRefundPercentage(currentCondition);
      
      // If price was already adjusted, we need to recalculate
      // For simplicity, we'll recalculate from the base order item price
      const basePrice = product.orderItem?.pricePerUnit || product.orderItemPricePerUnit || product.returnItemPricePerUnit;
      const refundPercentage = this.getRefundPercentage(currentCondition);
      product.returnItemPricePerUnit = basePrice * refundPercentage;
    }
    
    // Show message about the condition impact
    const message = this.getConditionRefundMessage(product.returnItemCondition);
    if (message) {
      const severity = this.getRefundPercentage(product.returnItemCondition) === 1.0 ? 'info' : 'warn';
      this.messageService.add({
        severity: severity,
        summary: this.translate.instant('refund_impact') || 'Refund Impact',
        detail: message,
        life: 4000
      });
    }
  }

  getConditionSeverity(condition: any): string {
    switch (condition) {
      case 'NEW': return 'success';
      case 'USED': return 'warning';
      case 'DAMAGED': return 'danger';
      default: return 'info';
    }
  }


  async onGetAllShops() {
    try {
      const response = await firstValueFrom(this.shopService.getShops()) as Shop[];
      this.shops = response;
    } catch (err: any) {
      console.error('Error loading shops:', err);
    }
  }

  onLazyLoad(event: LazyLoadEvent) {
    const extendedEvent: LazyLoadEventExt = {
      ...event,
      globalFilter: this.globalFilter
    };

    this.updateLastLazyLoadEvent(extendedEvent);
    this.loadReturns();
  }

  private updateLastLazyLoadEvent(event: LazyLoadEvent) {
    persistTablePageSizeFromLazyEvent(TablePageSizeKeys.returns, this.rowsPerPageOptions, event, {
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

  loadReturns() {
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;

    const page = first! / rows!;
    const size = rows!;
    const direction = sortOrder === -1 ? 'ASC' : 'DESC';
    
    // Pass filters as-is - the service expects { field: { value: ..., matchMode: ... } } format
    const filterPayload = filters || {};

    this.returnService.getReturnsPaginated(
      page,
      size,
      globalFilter || '',
      sortField!,
      direction,
      filterPayload
    ).subscribe({
      next: (res: any) => {
        // Assign the paginated returns
        this.returns = res.page.content.map((r: any) => {
          return {
            ...r,
            creationDate: r.creationDate ? new Date(r.creationDate) : null,
            returnDate: r.returnDate ? new Date(r.returnDate) : null
          };
        });

        // Assign total records from backend
        this.totalRecords = res.totalReturns || res.page?.totalElements || 0;

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
          detail: this.translate.instant('error_while_getting_returns'),
          life: 3000
        });
      }
    });
  }

  // Keep this method for backward compatibility but make it call loadReturns
  async onGetAllReturns() {
    this.loadReturns();
  }

  async onDeleteReturn(id: any, force: boolean = false) {
    await this.returnService.deleteReturn(id, force)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.loadReturns();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('return_deleted_successfully'),
            life: 3000
          });
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_deleting_return'),
            life: 3000
          });
          console.log(err);
        },
      });
  }


  async onCancelReturn(id: any) {
    this.returnService.cancelReturn(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.loadReturns();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('return_canceled_successfully'),
            life: 3000
          });
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_canceling_return'),
            life: 3000
          });
          console.log(err);
        },
      });
  }


  async updateReturn(id: any, orderReturn: any): Promise<any> {
    console.log(orderReturn);
    await this.returnService.updateReturn(id, orderReturn)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.loadReturns();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('return_updated_successfully'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_return'),
            life: 3000
          });
          return false;
        },
      });
  }

  async addReturn(orderReturn: any): Promise<any> {
    console.log(orderReturn);

    await this.returnService.saveReturn(orderReturn).subscribe({
      next: (response: any) => {
        console.log(response);
        this.loadReturns();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('return_added_successfully'),
          life: 3000
        });
        return true;
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_adding_return'),
          life: 3000
        });
        console.log(err);
        return false;
      },
    });
  }


  async onGetAllOrders() {
    try {
      this.isLoading = true;
      const response = await this.orderService.getEligibleOrdersForReturn().toPromise();

      // Preprocess orders to include itemCount
      this.orders = (response as Order[]).map(order => ({
        ...order,
        itemCount: this.calculateOrderItemsCount(order)
      }));

      this.isLoading = false;
    } catch (error) {
      this.isLoading = false;
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_orders'),
        life: 3000
      });
      console.error('Error fetching orders:', error);
    }
  }

  calculateOrderItemsCount(order: Order): number {
    try {
      // Check if orderItems exists and is an array
      if (order?.orderItems && Array.isArray(order.orderItems)) {
        return order.orderItems.length;
      }
      return 0;
    } catch (e) {
      console.warn('Error calculating order items count:', e);
      return 0;
    }
  }


  onSortChange(event: any) {
    const value = event.value;

    if (value.indexOf('!') === 0) {
      this.sortReturn = -1;
      this.sortField = value.substring(1, value.length);
    } else {
      this.sortReturn = 1;
      this.sortField = value;
    }
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

      // Fetch all filtered returns from backend using pagination
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredReturns: any[] = [];
      const pageSize = 1000;
      let currentPage = 0;
      let hasMorePages = true;
      const maxPages = 100; // Safety limit
      
      // Build filters object from component filter properties
      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
      const direction = sortOrder === -1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...filters };
      
      // Ensure token is loaded
      this.returnService.loadToken();
      
      // Fetch all pages
      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;

        const response: any = await firstValueFrom(
          this.returnService.getReturnsPaginated(
            currentPage,
            pageSize,
            globalFilter || '',
            sortField || 'returnDate',
            direction,
            filterPayload
          )
        );

        const pageContent = response.page?.content || response.content || response || [];
        allFilteredReturns = allFilteredReturns.concat(pageContent);

        // Check if there are more pages
        const totalElements = response.page?.totalElements || response.totalElements || response.total || 0;
        hasMorePages = allFilteredReturns.length < totalElements && pageContent.length > 0;
        currentPage++;
      }

      // Check if we have data to export
      if (allFilteredReturns.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('no_data_to_export') || 'No data available to export',
          life: 3000
        });
        this.isExporting = false;
        this.exportProgress = '';
        this.translate.use(currentLang);
        return;
      }

      // Debug: Log the fetched data
      console.log('Fetched returns for export:', allFilteredReturns.length, allFilteredReturns);

      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';
      
      // Create export columns that match the export data keys
      const exportColumns: ExportColumn[] = [
        { title: this.translate.instant('return_reference'), dataKey: 'reference' },
        { title: this.translate.instant('order_reference'), dataKey: 'orderReference' },
        { title: this.translate.instant('customer'), dataKey: 'customerName' },
        { title: this.translate.instant('return_date'), dataKey: 'returnDate' },
        { title: this.translate.instant('return_status'), dataKey: 'status' },
        { title: this.translate.instant('total_amount'), dataKey: 'totalAmount' },
        { title: this.translate.instant('paid_amount'), dataKey: 'refundAmount' }
      ];
      
      const translatedExportColumns: ExportColumn[] = exportColumns;
      
      // Prepare data for export - ensure all dataKeys match the export data keys
      const exportData = allFilteredReturns.map(returnObj => {
        // Get customer display name
        let customerName = 'N/A';
        if (returnObj.order?.customer) {
          customerName = this.getCustomerDisplayName(returnObj.order.customer);
        }
        
        // Translate status
        const rawStatus: string = returnObj.returnStatus || '';
        let statusLabel: string = rawStatus;
        if (rawStatus) {
          const key = `return_status_${rawStatus.toLowerCase()}`;
          const translated = this.translate.instant(key);
          statusLabel = translated && translated !== key ? translated : rawStatus;
        }
        
        const exportReturn: any = {
          reference: returnObj.reference || 'N/A',
          orderReference: returnObj.order?.reference || 'N/A',
          customerName: customerName,
          returnDate: returnObj.returnDate ? this.datePipe.transform(returnObj.returnDate, 'dd/MM/yyyy') : 'N/A',
          status: statusLabel,
          totalAmount: returnObj.totalRefundableAmount || 0,
          refundAmount: returnObj.refunds?.reduce((sum: number, refund: any) => sum + (refund.amount || 0), 0) || 0
        };
        return exportReturn;
      });
      
      // Debug: Log the export data
      console.log('Export data prepared:', exportData.length, exportData);
      console.log('Export columns:', translatedExportColumns);
      
      // Get translated title for PDF
      const pdfTitle = this.translate.instant('returns_menu_title') || this.translate.instant('returns');
      
      // Export with translated headers and title
      this.reportingService.exportPdf(translatedExportColumns, exportData, 'returns', pdfTitle, organization?.organizationName);
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredReturns.length} records exported.`,
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

      // Fetch all filtered returns from backend using pagination
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredReturns: any[] = [];
      const pageSize = 1000;
      let currentPage = 0;
      let hasMorePages = true;
      const maxPages = 100; // Safety limit
      
      // Build filters object from component filter properties
      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
      const direction = sortOrder === -1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...filters };
      
      // Ensure token is loaded
      this.returnService.loadToken();
      
      // Fetch all pages
      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;

        const response: any = await firstValueFrom(
          this.returnService.getReturnsPaginated(
            currentPage,
            pageSize,
            globalFilter || '',
            sortField || 'returnDate',
            direction,
            filterPayload
          )
        );

        const pageContent = response.page?.content || response.content || response || [];
        allFilteredReturns = allFilteredReturns.concat(pageContent);

        // Check if there are more pages
        const totalElements = response.page?.totalElements || response.totalElements || response.total || 0;
        hasMorePages = allFilteredReturns.length < totalElements && pageContent.length > 0;
        currentPage++;
      }

      // Check if we have data to export
      if (allFilteredReturns.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('no_data_to_export') || 'No data available to export',
          life: 3000
        });
        this.isExporting = false;
        this.exportProgress = '';
        this.translate.use(currentLang);
        return;
      }

      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';
      
      // Create translated version of the data with translated headers
      const translatedReturns = allFilteredReturns.map(returnObj => {
        // Get customer display name
        let customerName = 'N/A';
        if (returnObj.order?.customer) {
          customerName = this.getCustomerDisplayName(returnObj.order.customer);
        }
        
        // Translate status
        const rawStatus: string = returnObj.returnStatus || '';
        let statusLabel: string = rawStatus;
        if (rawStatus) {
          const key = `return_status_${rawStatus.toLowerCase()}`;
          const translated = this.translate.instant(key);
          statusLabel = translated && translated !== key ? translated : rawStatus;
        }
        
        const translated: any = {
          [this.translate.instant('return_reference')]: returnObj.reference || 'N/A',
          [this.translate.instant('order_reference')]: returnObj.order?.reference || 'N/A',
          [this.translate.instant('customer')]: customerName,
          [this.translate.instant('return_date')]: returnObj.returnDate ? this.datePipe.transform(returnObj.returnDate, 'dd/MM/yyyy') : 'N/A',
          [this.translate.instant('return_status')]: statusLabel,
          [this.translate.instant('total_amount')]: returnObj.totalRefundableAmount || 0,
          [this.translate.instant('paid_amount')]: returnObj.refunds?.reduce((sum: number, refund: any) => sum + (refund.amount || 0), 0) || 0
        };
        return translated;
      });

      // Export the translated array to Excel
      this.reportingService.exportExcel(translatedReturns, 'returns', {
        title: this.translate.instant('returns_menu_title'),
        organizationName: organization?.organizationName,
        generatedLabel: this.translate.instant('export_generated_on'),
        generatedAt: new Date().toLocaleString(defaultLocale),
      });
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredReturns.length} records exported.`,
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

  moveProductToTarget(product: Product): void {
    this.addProductToReturn(product);
  }


  searchProductByBarcode(barcode: string): Product | undefined {
    const code = barcode.trim().toLowerCase();
    return this.sourceProducts.find((p: Product) => (p.reference || '').trim().toLowerCase() === code);
  }

  /**
   * A scanned code is usually a barcode value, not the product reference, so an unmatched code is
   * resolved through the barcode API and mapped back to the returnable products of this order.
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
        this.moveProductToTarget(product);
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

  calculateTotalAmount(): number {
    let total = 0;

    // Calculate the total based on product quantities and prices
    for (const product of this.targetProducts) {
      total += product.returnItemQuantity * product.returnItemPricePerUnit;
    }

    // Ensure the total is not below zero after applying the discount
    if (total < 0) {
      total = 0;
    }

    // Return the final total
    return total;
  }

  openReturnDetailsDialog(returnData: OrderReturn): void {
    if (!returnData || !returnData.returnId) return;
    this.router.navigate(['/sales/returns', returnData.returnId]);
  }

  getReturnReasonLabel(reason: string): string {
    const found = this.returnReasons.find(r => r.value === reason);
    return found ? found.label : reason;
  }

  getRefundMethodIcon(method: string): string {
    switch (method) {
      case 'Cash': return 'pi pi-money-bill';
      case 'Card': return 'pi pi-credit-card';
      case 'Transfer': return 'pi pi-bank';
      case 'Check': return 'pi pi-file-edit';
      case 'BOE': return 'pi pi-file-edit';
      default: return 'pi pi-dollar';
    }
  }

  getRefundStatusSeverity(status: string): string {
    switch (status?.toUpperCase()) {
      case 'UNREFUNDED': return 'danger';
      case 'PARTIALLY_REFUNDED': return 'warning';
      case 'REFUNDED': return 'success';
      case 'PENDING': return 'warning';
      case 'PROCESSING': return 'info';
      case 'COMPLETED': return 'success';
      case 'FAILED': return 'danger';
      default: return 'danger';
    }
  }


  getRefundMethodSeverity(method: string): string {
    switch (method?.toLowerCase()) {
      case 'cash': return 'success';
      case 'card': return 'info';
      case 'transfer': return 'warning';
      case 'check': return 'help';
      case 'boe': return 'help';
      default: return 'danger';
    }
  }

  canProcessRefund(): boolean {
    return this.return?.returnStatus !== ReturnStatus.COMPLETED &&
      this.return?.totalRefundableAmount > 0;
  }

  viewOrder(order: Order): void {
    // Implement your order view logic
    console.log('View order:', order);
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('order_details'),
      detail: this.translate.instant('showing_details_for_order', { orderId: order.orderId })
    });
  }

  processRefund(): void {
    // Implement your refund processing logic
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('process_refund'),
      detail: this.translate.instant('opening_refund_dialog')
    });
  }

  printReturn(): void {
    window.print();
  }

  generateReturnNote(orderReturn: OrderReturn) {
      this.financialDocService.generateReturnNoteFromReturn(orderReturn.returnId).subscribe({
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

  exportToPDF(): void {
    // Implement PDF export logic
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('export_pdf'),
      detail: this.translate.instant('return_exported_pdf')
    });
  }

  /**
   * Check if a refund is currently active in the timeline
   */
  isRefundActive(refund: Refund): boolean {
    if (!this.return?.refunds || this.return.refunds.length === 0) {
      return false;
    }

    // Assuming the most recent refund is active, or use your business logic
    const latestRefund = this.return.refunds[this.return.refunds.length - 1];
    return refund.refundId === latestRefund.refundId;
  }


  /**
   * Get condition label for display
   */
  getConditionLabel(condition: string): string {
    const conditionItem = this.itemConditions?.find(item => item.value === condition);
    return conditionItem?.label || condition || 'N/A';
  }

  /**
   * Get return status severity for tags
   */
  getReturnStatusSeverity(status: ReturnStatus): string {
    const statusSeverity: { [key: string]: string } = {
      'PENDING': 'warning',
      'APPROVED': 'success',
      'REJECTED': 'danger',
      'COMPLETED': 'success',
      'CANCELLED': 'danger',
      'PROCESSING': 'info'
    };

    return statusSeverity[status] || 'info';
  }


  /**
   * Refresh return details
   */
  refreshReturnDetails(): void {
    if (this.return?.returnId) {
      // Implement your refresh logic here
      console.log('Refreshing return details:', this.return.returnId);

      // Example implementation:
      // this.returnService.getReturnById(this.return.returnId).subscribe({
      //     next: (returnData) => {
      //         this.return = returnData;
      //     },
      //     error: (error) => {
      //         this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to refresh return details'});
      //     }
      // });
    }
  }


  /**
   * Calculate total refunded amount
   */
  getTotalRefundedAmount(): number {
    if (!this.return?.refunds || this.return.refunds.length === 0) {
      return 0;
    }

    return this.return.refunds.reduce((total: number, refund: Refund) => {
      return total + (refund.amount || 0);
    }, 0);
  }

  /**
   * Get remaining refundable amount
   */
  getRemainingRefundableAmount(): number {
    const totalRefundable = this.return?.totalRefundableAmount || 0;
    const totalRefunded = this.getTotalRefundedAmount();
    return Math.max(0, totalRefundable - totalRefunded);
  }

  /**
   * Check if return is fully refunded
   */
  isFullyRefunded(): boolean {
    return this.getRemainingRefundableAmount() <= 0;
  }

  getQuantitySeverity(quantity: number): string {
      if (quantity === undefined || quantity === null) return 'info';
      if (quantity <= 0) return 'danger';
      if (quantity < this.lowStockThreshold) return 'warning';
      return 'success';
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

  getMeasureUnit(product: Product, quantity?: number): string {
    return getLineMeasureUnit(product, quantity);
  }

  getReturnMaxQuantity(product: Product): number {
    const orderItem = product.orderItem;
    if (!orderItem) {
      return 0;
    }
    return getOrderItemDisplayRemainingQuantity(orderItem);
  }

  getReturnOrderedQuantity(product: Product): number {
    const orderItem = product.orderItem || this.findOrderItemForProduct(product);
    if (!orderItem) {
      return 0;
    }
    return getOrderItemDisplayQuantity(orderItem);
  }

  formatReturnOrderedQuantity(product: Product): string {
    return this.formatLineQuantity(product, this.getReturnOrderedQuantity(product));
  }

  getReturnRemainingQuantity(product: Product): number {
    const max = this.getReturnMaxQuantity(product);
    return Math.max(0, max - (product.returnItemQuantity || 0));
  }

  formatReturnItemQty(item: ReturnItem): string {
    return formatLineQty(item?.product, QuantityScale.toDisplayQuantity(item?.product, item?.returnedQuantity ?? 0));
  }

  getReturnItemMeasureUnit(item: ReturnItem): string {
    return getLineMeasureUnit(item?.product, QuantityScale.toDisplayQuantity(item?.product, item?.returnedQuantity ?? 0));
  }

}
