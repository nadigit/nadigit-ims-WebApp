import { ChangeDetectorRef, Component, OnDestroy, OnInit, Pipe, PipeTransform, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MessageService, LazyLoadEvent, SelectItem } from 'primeng/api';
import { Table } from 'primeng/table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { PurchaseReturn } from 'src/app/models/purchaseReturn';
import { PurchaseReturnItem } from 'src/app/models/purchaseReturnItem';
import { PurchaseReturnService } from 'src/app/services/purchase-return.service';
import { ReturnStatus } from 'src/app/enums/return-status.enum';
import { PurchaseItem } from 'src/app/models/purchaseItem';
import { Purchase } from 'src/app/models/purchase';
import { PurchaseService } from 'src/app/services/purchase.service';
import { Product } from 'src/app/models/product';
import { PurchaseCredit } from 'src/app/models/purchaseCredit';
import { firstValueFrom, Subscription } from 'rxjs';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { DatePipe } from '@angular/common';
import {
  initTablePageSizeState,
  persistTablePageSizeFromLazyEvent,
  TablePageSizeKeys,
} from 'src/app/utils/table-page-size.storage';
import {
  buildPurchaseReturnItemPayload,
  computePurchaseReturnCreditAmount,
  defaultLineQuantity,
  formatLineQuantity,
  formatLineQuantity as formatLineQty,
  getLineMeasureUnit,
  getPurchaseItemDisplayQuantity,
  getPurchaseReturnItemDisplayQuantity as purchaseReturnItemDisplayQty,
  getPurchaseReturnMaxDisplayQuantity,
  lineQuantityDecimals,
  lineQuantityMin,
  lineQuantityStep,
} from 'src/app/shared/product-utils';

interface LazyLoadEventExt extends LazyLoadEvent {
  globalFilter?: string;
  filters?: { [field: string]: any };
}

@Pipe({
  name: 'filterProducts'
})
export class FilterProductsPipe implements PipeTransform {
  transform(source: any[], selectedProducts: any[]): any[] {
    return source.filter(product => !selectedProducts.includes(product));
  }
}

@Component({
  templateUrl: './purchase-returns.component.html',
  styleUrls: ['./purchase-returns.component.css', '../purchases.component.css'],
  providers: [MessageService, DatePipe]
})
export class PurchaseReturnsComponent implements OnInit, OnDestroy {

  Ressource: string = 'PURCHASE_RETURNS';

  currency: any;

  returnDialog: boolean = false;
  detailsDialog: boolean = false;
  deleteReturnDialog: boolean = false;
  cancelReturnDialog: boolean = false;
  deleteReturnsDialog: boolean = false;

  products: Product[] = [];
  product: Product = {};
  returns: PurchaseReturn[] = [];
  return: PurchaseReturn = {};
  purchases: Purchase[] = [];
  selectedProducts: Product[] = [];
  selectedReturns: PurchaseReturn[] = [];
  submitted: boolean = false;
  cols: any[] = [];
  statuses: any[] = [];

  // Filter properties
  selectedReturnStatus: string | null = null;
  selectedSupplier: any = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  suppliers: any[] = []; // Unique suppliers from purchases

  // Pagination & lazy loading
  rowsPerPageOptions = [20, 50, 100];
  pageSize = 20;
  totalRecords: number = 0;
  globalFilter: string = '';
  lastLazyLoadEvent: LazyLoadEventExt = {
    first: 0,
    rows: 20,
    sortField: 'returnDate',
    sortOrder: -1
  };

  exportColumns!: ExportColumn[];
  expandedRows: { [key: string]: boolean } = {};
  sourceProducts: Product[] = [];
  targetProducts: Product[] = [];
  selectedReturnProduct: Product | null = null;
  userRoles: any;
  isAdmin: boolean = false;
  returnReasons: any[] = [];
  itemConditions: any[] = [];
  canAddReturn: boolean = false;
  canEditReturn: boolean = false;
  canDeleteReturn: boolean = false;
  canReadReturn: boolean = false;
  canCancelReturn: boolean = false;
  isLoading: boolean = true;
  isExporting: boolean = false;
  exportProgress: string = '';
  isInitialLoad: boolean = true; // Flag to prevent double loading
  lowStockThreshold: number = 10;
  Math = Math;

  private configSavedSub?: Subscription;

  constructor(
    private messageService: MessageService,
    private purchaseReturnService: PurchaseReturnService,
    private purchaseService: PurchaseService,
    private cdr: ChangeDetectorRef,
    private configService: AppConfigurationService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private router: Router,
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private datePipe: DatePipe
  ) {
    this.loadTaxRate();
  }

  async ngOnInit() {
    this.isLoading = true;
    initTablePageSizeState(TablePageSizeKeys.purchaseReturns, this.rowsPerPageOptions, {
      pageSize: this.pageSize,
      lastLazyLoadEvent: this.lastLazyLoadEvent,
    });
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
    this.lowStockThreshold = await this.getLowStockThreshold();

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
      }
    });

    this.initializeTranslations();
    this.initializeStatuses();
    await Promise.all([
      this.setUserRoles(),
      this.checkPermissions(),
    ]);
    // Initialize table columns and export columns
    this.initializeTableColumns();
    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

    const qpReturnStatus = this.route.snapshot.queryParamMap.get('returnStatus');
    if (qpReturnStatus) {
      const upper = qpReturnStatus.trim().toUpperCase();
      const normalized = upper === 'CANCELLED' ? 'CANCELED' : upper;
      const allowed = new Set(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELED']);
      if (allowed.has(normalized)) {
        this.selectedReturnStatus = normalized;
      }
    }

    // Load first page via paginated endpoint
    // The table has *ngIf="!isLoading" so it won't render until after this completes,
    // preventing the double call from onLazyLoad
    if (this.selectedReturnStatus) {
      this.applyFilters();
    } else {
      await this.loadReturns();
    }
    
    // Check for purchaseId query parameter to pre-select purchase
    this.route.queryParams.subscribe(params => {
      if (params['purchaseId']) {
        const purchaseId = +params['purchaseId'];
        if (purchaseId && !isNaN(purchaseId)) {
          this.openNewWithPurchase(purchaseId);
        }
      }
    });
  }
  
  async openNewWithPurchase(purchaseId: number) {
    if (!this.canAddReturn) return;
    await this.onGetAllPurchases();
    const purchase = this.purchases.find(p => p.purchaseId === purchaseId);
    if (purchase) {
      this.return = {};
      this.return.purchase = purchase;
      this.targetProducts = [];
      this.selectedReturnProduct = null;
      this.return.returnDate = new Date();
      this.submitted = false;
      this.refreshAvailablePurchaseProducts();
      this.returnDialog = true;
    }
  }

  private initializeTranslations() {
    this.translateService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang);
    });
    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe((translations) => {
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
    // Align exported columns with the actual purchase returns table
    this.cols = [
      { field: 'reference', header: this.translateService.instant('return_reference') },
      { field: 'returnDate', header: this.translateService.instant('return_date') },
      { field: 'totalCreditableAmount', header: this.translateService.instant('return_refund_amount') },
      { field: 'returnStatus', header: this.translateService.instant('return_status') },
      { field: 'purchaseReference', header: this.translateService.instant('purchase_reference') },
      { field: 'supplierName', header: this.translateService.instant('supplier') }
    ];
  }

  hideDialog() {
    this.returnDialog = false;
    this.submitted = false;
    this.selectedReturnProduct = null;
  }

  refreshAvailablePurchaseProducts(): void {
    this.sourceProducts = this.getAvailablePurchaseProducts();
  }

  onReturnPurchaseChange(): void {
    this.targetProducts = [];
    this.selectedReturnProduct = null;
    this.refreshAvailablePurchaseProducts();
  }

  getAvailablePurchaseProducts(): Product[] {
    if (!this.return?.purchase?.purchaseItems?.length) {
      return [];
    }

    const selectedIds = new Set(this.targetProducts.map(product => product.productId));
    return this.return.purchase.purchaseItems
      .filter(purchaseItem => purchaseItem.product?.productId && !selectedIds.has(purchaseItem.product.productId))
      .map(purchaseItem => this.mapPurchaseItemToReturnProduct(purchaseItem));
  }

  mapPurchaseItemToReturnProduct(purchaseItem: PurchaseItem): Product {
    const product = { ...purchaseItem.product } as Product;
    product['purchaseItem'] = purchaseItem;
    product.returnItemPricePerUnit = purchaseItem.buyingPrice;
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

    const purchaseItem = product['purchaseItem'] || this.findPurchaseItemForProduct(product);
    if (!purchaseItem) {
      console.error('Original purchase item not found for product:', product);
      return;
    }

    const unitPrice = purchaseItem.buyingPrice ?? product.returnItemPricePerUnit ?? 0;
    this.targetProducts.push({
      ...product,
      purchaseItem,
      returnItemPricePerUnit: unitPrice,
      returnItemQuantity: defaultLineQuantity(product),
      returnItemCondition: 'NEW',
      returnItemReason: 'INCORRECT_ITEM',
    });
    this.refreshAvailablePurchaseProducts();
    this.cdr.detectChanges();
  }

  removeProductFromReturn(product: Product): void {
    this.targetProducts = this.targetProducts.filter(item => item.productId !== product.productId);
    this.refreshAvailablePurchaseProducts();
    this.cdr.detectChanges();
  }

  getReturnLineSubtotal(product: Product): number {
    return computePurchaseReturnCreditAmount(
      product,
      product.returnItemQuantity || 0,
      product.returnItemPricePerUnit || 0
    );
  }

  getReturnMaxQuantity(product: Product): number {
    const purchaseItem = product['purchaseItem'] as PurchaseItem | undefined;
    return purchaseItem ? getPurchaseReturnMaxDisplayQuantity(purchaseItem) : 0;
  }

  getReturnOrderedQuantity(product: Product): number {
    const purchaseItem = product['purchaseItem'] || this.findPurchaseItemForProduct(product);
    if (!purchaseItem) {
      return 0;
    }
    return getPurchaseItemDisplayQuantity(purchaseItem);
  }

  formatReturnOrderedQuantity(product: Product): string {
    return this.formatLineQuantity(product, this.getReturnOrderedQuantity(product));
  }

  getReturnRemainingQuantity(product: Product): number {
    const max = this.getReturnMaxQuantity(product);
    return Math.max(0, max - (product.returnItemQuantity || 0));
  }

  formatLineQuantity(product: Product, quantity: number | null | undefined): string {
    return formatLineQty(product, quantity);
  }

  ngOnDestroy(): void {
    this.configSavedSub?.unsubscribe();
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canAddReturn = this.permissionService.canCreate(this.Ressource);
    this.canEditReturn = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteReturn = this.permissionService.canDelete(this.Ressource);
    this.canReadReturn = this.permissionService.canRead(this.Ressource);
    this.canCancelReturn = this.permissionService.canProcess(this.Ressource);
  }

  async loadTaxRate() {
    (await this.configService.getConfiguration("tax")).subscribe((response: any) => {
      // Tax rate loaded if needed
    });
  }

  toggleRow(returnID: string): void {
    this.expandedRows[returnID] = !this.expandedRows[returnID];
  }

  isRowExpanded(returnID: string): boolean {
    return this.expandedRows[returnID] === true;
  }

  getPurchaseDisplayLabel = (purchase: any): string => {
    if (!purchase) return '';
    const reference = purchase.reference || 'N/A';
    const totalAmount = purchase.totalAmount;
    const itemCount = purchase.itemCount !== undefined ? purchase.itemCount : this.getSafeItemsCount(purchase);
    const supplierName = purchase.supplier?.supplierName || 'N/A';
    return `#${reference} • ${totalAmount} ${this.currency} • ${itemCount} ${this.translate.instant('items')} • ${supplierName}`;
  }

  getSafeItemsCount(purchase: any): number {
    try {
      if (!purchase) return 0;
      if (!purchase.purchaseItems) return 0;
      if (!Array.isArray(purchase.purchaseItems)) return 0;
      return purchase.purchaseItems.length;
    } catch (e) {
      return 0;
    }
  }

  deleteSelectedReturns() {
    if (!this.canDeleteReturn) return;
    this.deleteReturnsDialog = true;
  }

  async editReturn(purchaseReturn: PurchaseReturn) {
    if (!this.canEditReturn) return;

    if (!this.purchases || this.purchases.length === 0) {
      await this.onGetAllPurchases();
    }

    this.return = { ...purchaseReturn };

    if (this.return.returnDate) {
      this.return.returnDate = typeof this.return.returnDate === 'string'
        ? new Date(this.return.returnDate)
        : this.return.returnDate;
    }

    if (this.return.purchase && !this.purchases.find(p => p.purchaseId === this.return.purchase?.purchaseId)) {
      this.purchases.push(this.return.purchase);
    }

    this.targetProducts = (this.return.returnItems || []).map(item => {
      const purchaseItem = item.purchaseItem || this.findPurchaseItemForProduct(item.product);
      const displayQty = purchaseReturnItemDisplayQty(item);
      const totalAmount = item.creditAmount ?? item.refundAmount ?? 0;
      const pricePerUnit = displayQty > 0
        ? totalAmount / displayQty
        : (purchaseItem?.buyingPrice ?? 0);

      return {
        ...item.product,
        purchaseItem,
        returnItemPricePerUnit: pricePerUnit || purchaseItem?.buyingPrice || 0,
        returnItemQuantity: displayQty || lineQuantityMin(item.product),
        returnItemCondition: item.condition || 'NEW',
        returnItemReason: item.reason || 'INCORRECT_ITEM',
      } as Product;
    });

    this.returnDialog = true;
    this.selectedReturnProduct = null;
    this.submitted = false;
    this.refreshAvailablePurchaseProducts();
  }

  deleteReturn(purchaseReturn: PurchaseReturn) {
    if (!this.canDeleteReturn) return;
    this.deleteReturnDialog = true;
    this.return = { ...purchaseReturn };
  }

  cancelReturn(purchaseReturn: PurchaseReturn) {
    if (!this.canCancelReturn) return;
    this.cancelReturnDialog = true;
    this.return = { ...purchaseReturn };
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

  async confirmCancelReturn() {
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
    this.onGetAllPurchases();
    this.refreshAvailablePurchaseProducts();
    this.returnDialog = true;
  }

  private findPurchaseItemForProduct(product: Product): PurchaseItem | undefined {
    return this.return.purchase?.purchaseItems?.find(
      item => item.product.productId === product.productId
    );
  }

  async saveReturn() {
    this.submitted = true;
    if (this.targetProducts.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('no_items_returned'),
        detail: this.translate.instant('at_least_one_product_must_be_selected'),
        life: 3000,
      });
      return;
    }
    const productsWithoutPurchaseItem = this.targetProducts.filter(p => !p['purchaseItem']);
    if (productsWithoutPurchaseItem.length > 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('invalid_products'),
        detail: this.translate.instant('some_products_missing_purchase_references'),
        life: 3000,
      });
      return;
    }
    if (this.return.returnDate) {
      const date = typeof this.return.returnDate === "string" ? new Date(this.return.returnDate) : this.return.returnDate;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      this.return.returnDate = `${year}-${month}-${day}`;
    }
    const returnItems: PurchaseReturnItem[] = this.targetProducts.map((product) => {
      const purchaseItem = product['purchaseItem'] as PurchaseItem;
      return buildPurchaseReturnItemPayload(
        product,
        purchaseItem,
        product.returnItemQuantity || lineQuantityMin(product),
        product.returnItemPricePerUnit || purchaseItem?.buyingPrice || 0,
        {
          condition: product.returnItemCondition || 'NEW',
          reason: product.returnItemReason || 'INCORRECT_ITEM',
        }
      );
    });
    const newPurchaseReturn: PurchaseReturn = {
      ...this.return,
      returnItems,
    };
    newPurchaseReturn.returnItems.forEach((returnItem) => {
      delete returnItem.product['returnItemQuantity'];
      delete returnItem.product['returnItemPricePerUnit'];
      delete returnItem.product['purchaseItem'];
      delete returnItem.product['returnItemCondition'];
      delete returnItem.product['returnItemReason'];
    });
    try {
      if (newPurchaseReturn.returnId) {
        await this.updateReturn(newPurchaseReturn.returnId, newPurchaseReturn);
        return;
      } else {
        await this.addReturn(newPurchaseReturn);
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

  applyFilters() {
    const filters: any = {};

    if (this.selectedReturnStatus) {
      filters.returnStatus = { value: this.selectedReturnStatus, matchMode: 'equals' };
    }
    if (this.selectedSupplier) {
      filters.supplierId = { value: this.selectedSupplier, matchMode: 'equals' };
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
      filters
    };

    this.updateLastLazyLoadEvent(lazyEvent);
    this.loadReturns();
  }

  onFilterChange() {
    this.applyFilters();
  }

  clearFilters() {
    this.selectedReturnStatus = null;
    this.selectedSupplier = null;
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

  onLazyLoad(event: LazyLoadEvent) {
    // Skip the initial lazy load event if we've already loaded in ngOnInit
    // This prevents double loading on initial page load
    if (this.isInitialLoad) {
      this.isInitialLoad = false;
      return;
    }

    const extendedEvent: LazyLoadEventExt = {
      ...event,
      globalFilter: this.globalFilter
    };

    this.updateLastLazyLoadEvent(extendedEvent);
    this.loadReturns();
  }

  updateLastLazyLoadEvent(event: LazyLoadEventExt) {
    persistTablePageSizeFromLazyEvent(TablePageSizeKeys.purchaseReturns, this.rowsPerPageOptions, event, {
      pageSize: this.pageSize,
    });
    const rows = event.rows || this.lastLazyLoadEvent.rows || this.pageSize;
    this.lastLazyLoadEvent = {
      first: event.first || 0,
      rows,
      sortField: event.sortField || 'returnDate',
      sortOrder: event.sortOrder || -1,
      globalFilter: event.globalFilter || this.globalFilter,
      filters: event.filters || this.lastLazyLoadEvent.filters || {}
    };
  }

  private initializeStatuses() {
    // Return statuses (based on what I see in the template)
    this.statuses = [
      { label: 'Pending', value: 'PENDING' },
      { label: 'Processing', value: 'PROCESSING' },
      { label: 'Completed', value: 'COMPLETED' },
      { label: 'Canceled', value: 'CANCELED' },
    ];
  }

  loadUniqueSuppliers() {
    // Extract unique suppliers from returns (through purchase.supplier)
    const supplierMap = new Map();
    this.returns.forEach(returnItem => {
      if (returnItem.purchase && returnItem.purchase.supplier) {
        const supplier = returnItem.purchase.supplier;
        if (!supplierMap.has(supplier.supplierId)) {
          supplierMap.set(supplier.supplierId, supplier);
        }
      }
    });
    this.suppliers = Array.from(supplierMap.values());
  }

  getConditionSeverity(condition: any): string {
    switch (condition) {
      case 'NEW': return 'success';
      case 'USED': return 'warning';
      case 'DAMAGED': return 'danger';
      default: return 'info';
    }
  }

  async loadReturns() {
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;

    const page = (first || 0) / (rows || 20);
    const size = rows || 20;
    const direction = sortOrder === 1 ? 'ASC' : 'DESC';
    const filterPayload = filters || {};

    try {
      const response = await firstValueFrom(
        this.purchaseReturnService.getReturnsPaginated(
          page,
          size,
          globalFilter || '',
          sortField || 'returnDate',
          direction,
          filterPayload
        )
      );

      const pageContent = response.page?.content || [];
      this.returns = pageContent.map((returnObj: any) => {
        if (returnObj.purchaseReturnId && !returnObj.returnId) {
          returnObj.returnId = returnObj.purchaseReturnId;
        }
        returnObj.creationDate = returnObj.creationDate ? new Date(returnObj.creationDate) : null;
        returnObj.returnDate = returnObj.returnDate ? new Date(returnObj.returnDate) : null;
        return returnObj;
      });

      this.totalRecords = response.page?.totalElements || response.totalReturns || 0;

      // Refresh suppliers based on current page
      this.loadUniqueSuppliers();

      this.isLoading = false;
      if (this.cdr) {
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error while getting purchase returns:', error);
      this.isLoading = false;
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_returns'),
        life: 3000
      });
    }
  }

  async onDeleteReturn(id: any, force: boolean = false) {
    await this.purchaseReturnService.deleteReturn(id, force).subscribe({
      next: (response: any) => {
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
      },
    });
  }

  async onCancelReturn(id: any) {
    this.purchaseReturnService.cancelReturn(id).subscribe({
      next: (response: any) => {
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
      },
    });
  }

  async updateReturn(id: any, purchaseReturn: any): Promise<any> {
    await this.purchaseReturnService.updateReturn(id, purchaseReturn).subscribe({
      next: (response: any) => {
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

  async addReturn(purchaseReturn: any): Promise<any> {
    await this.purchaseReturnService.saveReturn(purchaseReturn).subscribe({
      next: (response: any) => {
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
        return false;
      },
    });
  }

  async onGetAllPurchases() {
    try {
      this.isLoading = true;
      const response = await this.purchaseService.getEligiblePurchasesForReturn().toPromise();
      this.purchases = (response as Purchase[]).map(purchase => ({
        ...purchase,
        itemCount: this.calculatePurchaseItemsCount(purchase)
      }));
      this.isLoading = false;
    } catch (error) {
      this.isLoading = false;
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_purchases'),
        life: 3000
      });
    }
  }

  calculatePurchaseItemsCount(purchase: Purchase): number {
    try {
      if (purchase?.purchaseItems && Array.isArray(purchase.purchaseItems)) {
        return purchase.purchaseItems.length;
      }
      return 0;
    } catch (e) {
      return 0;
    }
  }

  calculateTotalAmount(): number {
    let total = 0;
    for (const product of this.targetProducts) {
      total += computePurchaseReturnCreditAmount(
        product,
        product.returnItemQuantity || 0,
        product.returnItemPricePerUnit || 0
      );
    }
    return total < 0 ? 0 : total;
  }

  quantityInputStep(product: Product): number {
    return lineQuantityStep(product);
  }

  quantityInputDecimals(product: Product): number {
    return lineQuantityDecimals(product);
  }

  returnQuantityMin(product: Product): number {
    return lineQuantityMin(product);
  }

  getMaxReturnDisplayQuantity(product: Product): number {
    const purchaseItem = product['purchaseItem'] as PurchaseItem | undefined;
    return purchaseItem ? getPurchaseReturnMaxDisplayQuantity(purchaseItem) : 0;
  }

  formatReturnQuantity(product: Product, quantity: number | null | undefined): string {
    return formatLineQuantity(product, quantity);
  }

  getMeasureUnit(product: Product, quantity?: number): string {
    return getLineMeasureUnit(product, quantity);
  }

  formatReturnItemDisplayQuantity(item: PurchaseReturnItem): string {
    return formatLineQuantity(item?.product, purchaseReturnItemDisplayQty(item));
  }

  getPurchaseReturnItemDisplayQuantity(item: PurchaseReturnItem): number {
    return purchaseReturnItemDisplayQty(item);
  }

  openReturnDetailsDialog(returnData: PurchaseReturn | any): void {
    if (!returnData) {
      return;
    }
    // Handle both returnId and purchaseReturnId (backend may use different field names)
    const returnId = returnData.returnId || returnData.purchaseReturnId;
    if (!returnId && returnId !== 0) {
      console.warn('Purchase return ID is missing:', returnData);
      return;
    }
    this.router.navigate(['/purchases/purchase-returns', returnId.toString()]);
  }

  getReturnReasonLabel(reason: string): string {
    const found = this.returnReasons.find(r => r.value === reason);
    return found ? found.label : reason;
  }

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

  getConditionLabel(condition: string): string {
    const conditionItem = this.itemConditions?.find(item => item.value === condition);
    return conditionItem?.label || condition || 'N/A';
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
      let allReturns: PurchaseReturn[] = [];
      const pageSize = 1000;
      let currentPage = 0;
      let hasMorePages = true;
      const maxPages = 100; // Safety limit
      
      // Build filters object from component filter properties
      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
      const direction = sortOrder === 1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...filters };
      
      // Ensure token is loaded
      this.purchaseReturnService.loadToken();
      
      // Fetch all pages
      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;
        
        const response = await firstValueFrom(
          this.purchaseReturnService.getReturnsPaginated(
            currentPage,
            pageSize,
            globalFilter || '',
            sortField || 'returnDate',
            direction,
            filterPayload
          )
        );
        
        const pageContent = response.page?.content || response.content || response || [];
        allReturns = allReturns.concat(pageContent);
        
        // Check if there are more pages
        const totalElements = response.page?.totalElements || response.totalElements || response.total || 0;
        hasMorePages = allReturns.length < totalElements && pageContent.length === pageSize;
        currentPage++;
      }
      
      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';
      
      // Build translated export columns based on organization's default locale
      const translationKeyMap: { [key: string]: string } = {
        'reference': 'return_reference',
        'returnDate': 'return_date',
        'totalCreditableAmount': 'return_refund_amount',
        'returnStatus': 'return_status',
        'purchaseReference': 'purchase_reference',
        'supplierName': 'supplier'
      };
      
      const translatedExportColumns: ExportColumn[] = this.exportColumns.map((col) => {
        const translationKey = translationKeyMap[col.dataKey] || col.dataKey;
        return {
          title: this.translate.instant(translationKey),
          dataKey: col.dataKey
        };
      });
      
      // Get translated title for PDF
      const pdfTitle = this.translate.instant('purchase_returns_menu_title') || this.translate.instant('purchase_returns');
      
      // Prepare returns for export with formatted fields
      const exportData = allReturns.map(purchaseReturn => {
        const purchase: any = purchaseReturn.purchase || {};
        const supplier: any = purchase.supplier || {};
        
        const rawStatus: string = purchaseReturn.returnStatus || '';
        let statusLabel: string = rawStatus;
        if (rawStatus) {
          const key = `return_status_${rawStatus.toLowerCase()}`;
          const translated = this.translate.instant(key);
          statusLabel = translated && translated !== key ? translated : rawStatus;
        }
        
        // Format return date as numeric date (dd/MM/yyyy)
        let formattedReturnDate: string = '';
        if (purchaseReturn.returnDate) {
          const date = purchaseReturn.returnDate instanceof Date 
            ? purchaseReturn.returnDate 
            : new Date(purchaseReturn.returnDate);
          formattedReturnDate = this.datePipe.transform(date, 'dd/MM/yyyy') || '';
        } else if (purchaseReturn.creationDate) {
          const date = purchaseReturn.creationDate instanceof Date 
            ? purchaseReturn.creationDate 
            : new Date(purchaseReturn.creationDate);
          formattedReturnDate = this.datePipe.transform(date, 'dd/MM/yyyy') || '';
        }
        
        return {
          reference: purchaseReturn.reference || '',
          returnDate: formattedReturnDate,
          totalCreditableAmount: purchaseReturn.totalCreditableAmount ?? 0,
          returnStatus: statusLabel,
          purchaseReference: purchase.reference || '',
          supplierName: supplier.name || ''
        };
      });
      
      // Export with translated headers and title
      this.reportingService.exportPdf(translatedExportColumns, exportData, 'purchase-returns', pdfTitle);
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allReturns.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting purchase returns PDF:', error);
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
      let allReturns: PurchaseReturn[] = [];
      const pageSize = 1000;
      let currentPage = 0;
      let hasMorePages = true;
      const maxPages = 100; // Safety limit
      
      // Build filters object from component filter properties
      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
      const direction = sortOrder === 1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...filters };
      
      // Ensure token is loaded
      this.purchaseReturnService.loadToken();
      
      // Fetch all pages
      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;
        
        const response = await firstValueFrom(
          this.purchaseReturnService.getReturnsPaginated(
            currentPage,
            pageSize,
            globalFilter || '',
            sortField || 'returnDate',
            direction,
            filterPayload
          )
        );
        
        const pageContent = response.page?.content || response.content || response || [];
        allReturns = allReturns.concat(pageContent);
        
        // Check if there are more pages
        const totalElements = response.page?.totalElements || response.totalElements || response.total || 0;
        hasMorePages = allReturns.length < totalElements && pageContent.length === pageSize;
        currentPage++;
      }
      
      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';
      
      // Map column field names to translation keys
      const translationKeyMap: { [key: string]: string } = {
        'reference': 'return_reference',
        'returnDate': 'return_date',
        'totalCreditableAmount': 'return_refund_amount',
        'returnStatus': 'return_status',
        'purchaseReference': 'purchase_reference',
        'supplierName': 'supplier'
      };
      
      // Prepare returns for export with formatted fields
      const modifiedReturns = allReturns.map(purchaseReturn => {
        const purchase: any = purchaseReturn.purchase || {};
        const supplier: any = purchase.supplier || {};
        
        const rawStatus: string = purchaseReturn.returnStatus || '';
        let statusLabel: string = rawStatus;
        if (rawStatus) {
          const key = `return_status_${rawStatus.toLowerCase()}`;
          const translated = this.translate.instant(key);
          statusLabel = translated && translated !== key ? translated : rawStatus;
        }
        
        // Format return date as numeric date (dd/MM/yyyy)
        let formattedReturnDate: string = '';
        if (purchaseReturn.returnDate) {
          const date = purchaseReturn.returnDate instanceof Date 
            ? purchaseReturn.returnDate 
            : new Date(purchaseReturn.returnDate);
          formattedReturnDate = this.datePipe.transform(date, 'dd/MM/yyyy') || '';
        } else if (purchaseReturn.creationDate) {
          const date = purchaseReturn.creationDate instanceof Date 
            ? purchaseReturn.creationDate 
            : new Date(purchaseReturn.creationDate);
          formattedReturnDate = this.datePipe.transform(date, 'dd/MM/yyyy') || '';
        }
        
        return {
          reference: purchaseReturn.reference || '',
          returnDate: formattedReturnDate,
          totalCreditableAmount: purchaseReturn.totalCreditableAmount ?? 0,
          returnStatus: statusLabel,
          purchaseReference: purchase.reference || '',
          supplierName: supplier.name || ''
        };
      });

      // Create a translated version of the data with translated headers
      // For Excel, we need to create objects with translated keys
      const translatedReturns = modifiedReturns.map(returnData => {
        const translated: any = {};
        this.cols.forEach(col => {
          const field = col.field;
          const translationKey = translationKeyMap[field] || field;
          const translatedHeader = this.translate.instant(translationKey);
          translated[translatedHeader] = (returnData as any)[field];
        });
        return translated;
      });

      // Now, export the translated array to Excel
      this.reportingService.exportExcel(translatedReturns, 'purchase-returns');
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allReturns.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting purchase returns Excel:', error);
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

  async getLowStockThreshold(): Promise<number> {
    try {
      const value = await firstValueFrom(await this.configService.getConfiguration('lowStockThreshold'));
      return (value !== undefined && value !== null) ? Number(value.value) : 10;
    } catch (error) {
      return 10;
    }
  }
}

