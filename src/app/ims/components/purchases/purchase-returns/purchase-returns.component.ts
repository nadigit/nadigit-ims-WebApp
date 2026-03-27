import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnChanges, OnInit, Pipe, PipeTransform, SimpleChanges, ViewChild } from '@angular/core';
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
import { firstValueFrom } from 'rxjs';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { DatePipe } from '@angular/common';

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
export class PurchaseReturnsComponent implements OnInit, OnChanges, AfterViewInit {

  @ViewChild('pickList') pickList: ElementRef | undefined;

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
  returnItems: PurchaseReturnItem[] = [];
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
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
    this.lowStockThreshold = await this.getLowStockThreshold();
    this.initializeTranslations();
    this.initializeStatuses();
    await Promise.all([
      this.setUserRoles(),
      this.checkPermissions(),
    ]);
    // Initialize table columns and export columns
    this.initializeTableColumns();
    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
    
    // Load first page via paginated endpoint
    // The table has *ngIf="!isLoading" so it won't render until after this completes,
    // preventing the double call from onLazyLoad
    await this.loadReturns();
    
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
      this.returnItems = [];
      this.return.returnDate = new Date();
      this.submitted = false;
      this.initializePickList();
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

  ngOnChanges(changes: SimpleChanges): void {
    if ('return' in changes) {
      this.initializePickList();
    }
  }

  ngAfterViewInit() {
    // Implementation if needed
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

  hideDialog() {
    this.returnDialog = false;
    this.submitted = false;
  }

  initializePickList(): void {
    this.sourceProducts = this.getSourceProducts();
    this.targetProducts = this.getTargetProducts();
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

  getSourceProducts(): Product[] {
    if (this.return && this.return.purchase && this.return.purchase.purchaseItems?.length > 0) {
      return this.return.purchase.purchaseItems
        .filter(purchaseItem =>
          !this.return.returnItems?.some(
            returnItem => returnItem.product.productId === purchaseItem.product?.productId
          )
        )
        .map(purchaseItem => {
          const product = { ...purchaseItem.product };
          product['purchaseItem'] = purchaseItem;
          product.returnItemPricePerUnit = purchaseItem.buyingPrice;
          return product;
        });
    } else {
      return [];
    }
  }

  getTargetProducts(): Product[] {
    let targetProducts: Product[] = [];
    if (this.return && this.return.returnItems && this.return.returnItems.length > 0) {
      this.return.returnItems.forEach(element => {
        targetProducts.push(element.product);
      });
      return targetProducts;
    } else {
      return [];
    }
  }

  deleteSelectedReturns() {
    if (!this.canDeleteReturn) return;
    this.deleteReturnsDialog = true;
  }

  async editReturn(purchaseReturn: PurchaseReturn) {
    if (!this.canEditReturn) return;
    
    // Load purchases if not already loaded
    if (!this.purchases || this.purchases.length === 0) {
      await this.onGetAllPurchases();
    }
    
    // Clone the purchaseReturn to prevent side-effects
    this.return = { ...purchaseReturn };
    
    // Ensure returnDate is a Date object for the calendar component
    if (this.return.returnDate) {
      this.return.returnDate = typeof this.return.returnDate === 'string' 
        ? new Date(this.return.returnDate) 
        : this.return.returnDate;
    }
    
    // Ensure the purchase is in the purchases array
    if (this.return.purchase && !this.purchases.find(p => p.purchaseId === this.return.purchase?.purchaseId)) {
      this.purchases.push(this.return.purchase);
    }
    
    // Initialize returnItems by mapping the return data to the required structure
    this.returnItems = this.return.returnItems?.map(item => {
      // Use creditAmount if available, otherwise refundAmount
      const totalAmount = item.creditAmount ?? item.refundAmount ?? 0;
      
      // Calculate price per unit from total amount
      let pricePerUnit = 0;
      if (item.returnedQuantity && item.returnedQuantity > 0) {
        pricePerUnit = totalAmount / item.returnedQuantity;
      } else if (item.purchaseItem?.buyingPrice) {
        pricePerUnit = item.purchaseItem.buyingPrice;
      }
      
      // Preserve purchaseItem reference if available
      const product = { ...item.product };
      if (item.purchaseItem) {
        product['purchaseItem'] = item.purchaseItem;
      } else if (this.return.purchase?.purchaseItems) {
        // Try to find the purchaseItem from the purchase
        const purchaseItem = this.return.purchase.purchaseItems.find(
          pi => pi.product?.productId === item.product?.productId
        );
        if (purchaseItem) {
          product['purchaseItem'] = purchaseItem;
          // If price per unit is 0, use the buying price from purchase item
          if (!pricePerUnit || pricePerUnit === 0) {
            product.returnItemPricePerUnit = purchaseItem.buyingPrice || 0;
          }
        }
      }
      
      return {
        returnItemId: item.returnItemId,
        product: {
          ...product,
          returnItemQuantity: item.returnedQuantity || 0,
          returnItemPricePerUnit: pricePerUnit || product['purchaseItem']?.buyingPrice || 0,
          returnItemCondition: item.condition || 'NEW',
          returnItemReason: item.reason || 'INCORRECT_ITEM',
        },
        returnedQuantity: item.returnedQuantity || 0,
        refundAmount: totalAmount,
        creditAmount: totalAmount,
        condition: item.condition || 'NEW',
        reason: item.reason || 'INCORRECT_ITEM',
        purchaseItem: item.purchaseItem,
      };
    }) || [];
    
    // Set the return dialog to true
    this.returnDialog = true;
    
    // Initialize pick list
    this.initializePickList();
    
    // Ensure targetProducts are updated with the current return items
    this.targetProducts = [...this.returnItems.map(item => item.product)];
    
    // Ensure all product properties are set correctly
    this.targetProducts.forEach(product => {
      if (!product.returnItemQuantity) {
        product.returnItemQuantity = 1;
      }
      if (!product.returnItemPricePerUnit && product['purchaseItem']) {
        product.returnItemPricePerUnit = product['purchaseItem'].buyingPrice || 0;
      }
      if (!product.returnItemCondition) {
        product.returnItemCondition = 'NEW';
      }
      if (!product.returnItemReason) {
        product.returnItemReason = 'INCORRECT_ITEM';
      }
    });
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

  async confirmDeleteSelected() {
    this.deleteReturnsDialog = false;
    await this.selectedReturns.forEach(selectedReturn => this.onDeleteReturn(selectedReturn.returnId));
    this.selectedReturns = [];
  }

  async confirmDelete() {
    this.deleteReturnDialog = false;
    await this.onDeleteReturn(this.return.returnId);
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
    this.returnItems = [];
    this.return.returnDate = new Date();
    this.submitted = false;
    this.onGetAllPurchases();
    this.initializePickList();
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
      const creditAmount = (product.returnItemPricePerUnit || 0) * (product.returnItemQuantity || 0);
      return {
        product: product,
        returnedQuantity: product.returnItemQuantity || 0,
        refundAmount: creditAmount,
        creditAmount: creditAmount,
        condition: product.returnItemCondition || 'NEW',
        purchaseItem: product['purchaseItem'],
        reason: product.returnItemReason || 'INCORRECT_ITEM',
      } as PurchaseReturnItem;
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
    this.lastLazyLoadEvent = {
      first: event.first || 0,
      rows: event.rows || 20,
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

  async onDeleteReturn(id: any) {
    await this.purchaseReturnService.deleteReturn(id).subscribe({
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

  onMoveToTarget(event: any): void {
    this.targetProducts.forEach((product: any) => {
      event.items.forEach((item: any) => {
        const purchaseItem = this.findPurchaseItemForProduct(product);
        if (!purchaseItem) {
          return;
        }
        if (product.productId === item.productId) {
          product.returnItemPricePerUnit = item.purchaseItemPricePerUnit || item.buyingPrice;
          product.returnItemQuantity = 1;
          product.returnItemCondition = 'NEW';
          product.returnItemReason = 'INCORRECT_ITEM';
          product.purchaseItem = purchaseItem;
        }
      });
    });
    this.cdr.detectChanges();
  }

  calculateTotalAmount(): number {
    let total = 0;
    for (const product of this.targetProducts) {
      total += product.returnItemQuantity * product.returnItemPricePerUnit;
    }
    return total < 0 ? 0 : total;
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

