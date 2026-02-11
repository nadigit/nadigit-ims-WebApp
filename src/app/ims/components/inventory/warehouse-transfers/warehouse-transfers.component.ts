import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { LazyLoadEvent, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Router, ActivatedRoute } from '@angular/router';
import { WarehouseTransfer, TransferItem, TransferStatus } from 'src/app/models/warehouseTransfer';
import { BatchMetadataUtil } from 'src/app/utils/batch-metadata.util';
import { WarehouseTransferService } from 'src/app/services/warehouse-transfer.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { ProductService } from 'src/app/services/product.service';
import { Warehouse } from 'src/app/models/warehouse';
import { Product } from 'src/app/models/product';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { DatePipe } from '@angular/common';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { firstValueFrom } from 'rxjs';

@Component({
  templateUrl: './warehouse-transfers.component.html',
  styleUrls: ['./warehouse-transfers.component.css', '../inventory.component.css'],
  providers: [MessageService, DatePipe]
})
export class WarehouseTransfersComponent implements OnInit {
  @ViewChild('dt') table!: Table;

  // List view
  transfers: WarehouseTransfer[] = [];
  selectedTransfers: WarehouseTransfer[] = [];
  isLoading: boolean = false;
  isExporting: boolean = false;
  exportProgress: string = '';
  totalRecords: number = 0;
  lastLazyLoadEvent?: LazyLoadEvent;
  isInitialLoad: boolean = true;
  
  // Filters
  selectedSourceWarehouse: any = null;
  selectedDestinationWarehouse: any = null;
  selectedStatus: string | null = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  pageSize: number = 20;
  pageSizeOptions = [20, 50, 100];
  
  // Dropdowns
  warehouses: any[] = [];
  availableSourceWarehouses: any[] = [];
  availableDestinationWarehouses: any[] = [];
  statusOptions: any[] = [];
  hasSingleWarehouse: boolean = false;
  
  // Product autocomplete (per item)
  productSuggestionsMap: Map<number, Product[]> = new Map();
  productSuggestionsLoadingMap: Map<number, boolean> = new Map();
  private latestProductSuggestionToken = 0;
  private cachedWarehouseProducts: Product[] = []; // Cache products for the current warehouse
  
  // Create/Edit form
  transferDialog: boolean = false;
  transfer: WarehouseTransfer = {};
  transferItems: TransferItem[] = [];
  sourceProducts: Product[] = [];
  submitted: boolean = false;
  isSaving: boolean = false;
  hasNoProductsInWarehouse: boolean = false;
  
  // Detail view (for confirmation dialogs)
  selectedTransfer: WarehouseTransfer = {};
  
  // Confirmation dialogs
  initiateConfirmDialog: boolean = false;
  completeConfirmDialog: boolean = false;
  cancelConfirmDialog: boolean = false;
  
  // Permissions
  canAddTransfer: boolean = false;
  canEditTransfer: boolean = false;
  canReadTransfer: boolean = false;
  isAdmin: boolean = false;
  
  resource: string = 'WAREHOUSE_TRANSFERS';
  
  exportColumns!: ExportColumn[];

  constructor(
    private transferService: WarehouseTransferService,
    private warehouseService: WarehouseService,
    private productService: ProductService,
    private messageService: MessageService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private keycloakService: KeycloakService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private reportingService: ReportingService,
    private organizationService: OrganizationService
  ) {}

  async ngOnInit() {
    await this.setPermissions();
    await this.setUserRoles();
    await this.initializeTranslations();
    await this.loadInitialData();
    
    // Initialize export columns
    this.exportColumns = [
      { title: this.translateService.instant('reference'), dataKey: 'reference' },
      { title: this.translateService.instant('source_warehouse'), dataKey: 'sourceWarehouseName' },
      { title: this.translateService.instant('destination_warehouse'), dataKey: 'destinationWarehouseName' },
      { title: this.translateService.instant('status'), dataKey: 'status' },
      { title: this.translateService.instant('items_count'), dataKey: 'itemsCount' },
      { title: this.translateService.instant('total_quantity'), dataKey: 'totalQuantity' },
      { title: this.translateService.instant('batch_info'), dataKey: 'batchInfo' },
      { title: this.translateService.instant('created_by'), dataKey: 'createdBy' }
    ];
  }

  async setUserRoles() {
    const roles = await this.keycloakService.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
  }

  async setPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canAddTransfer = this.permissionService.canCreate(this.resource);
    this.canEditTransfer = this.permissionService.canUpdate(this.resource);
    this.canReadTransfer = this.permissionService.canRead(this.resource);
  }

  async initializeTranslations() {
    this.translateService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang);
    });

    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe((translations) => {
      this.statusOptions = [
        { label: translations['transfer_status_pending'] || 'PENDING', value: 'PENDING' },
        { label: translations['transfer_status_in_transit'] || 'IN_TRANSIT', value: 'IN_TRANSIT' },
        { label: translations['transfer_status_completed'] || 'COMPLETED', value: 'COMPLETED' },
        { label: translations['transfer_status_cancelled'] || 'CANCELLED', value: 'CANCELLED' }
      ];
    });
  }

  async loadInitialData() {
    await this.loadWarehouses();
    // Don't call loadTransfers() here - let the table's lazy load event handle the initial load
  }

  async loadWarehouses() {
    try {
      this.warehouseService.getWarehouses().subscribe({
        next: (response: any) => {
          const warehousesList = Array.isArray(response) ? response : (response || []);
          this.warehouses = warehousesList.map((w: Warehouse) => ({
            label: w.name || '',
            value: w.warehouseId,
            warehouse: w
          }));
          // Initialize available warehouses lists
          this.updateAvailableWarehouses();
          // UX: detect single-warehouse scenario
          this.hasSingleWarehouse = this.warehouses.length === 1;

          if (this.hasSingleWarehouse) {
            this.messageService.add({
              severity: 'info',
              summary: this.translate.instant('information'),
              detail: this.translate.instant('warehouse_transfer_single_warehouse_warning') || 'You cannot create transfers because only one warehouse exists.',
              life: 5000
            });
          }
        },
        error: (err: any) => {
          console.error('Error loading warehouses:', err);
        }
      });
    } catch (error) {
      console.error('Error loading warehouses:', error);
    }
  }

  updateAvailableWarehouses() {
    // Update available source warehouses (exclude destination)
    if (!this.transfer.destinationWarehouse?.warehouseId) {
      this.availableSourceWarehouses = this.warehouses;
    } else {
      this.availableSourceWarehouses = this.warehouses.filter(
        (w: any) => w.warehouse?.warehouseId !== this.transfer.destinationWarehouse?.warehouseId
      );
    }

    // Update available destination warehouses (exclude source)
    if (!this.transfer.sourceWarehouse?.warehouseId) {
      this.availableDestinationWarehouses = this.warehouses;
    } else {
      this.availableDestinationWarehouses = this.warehouses.filter(
        (w: any) => w.warehouse?.warehouseId !== this.transfer.sourceWarehouse?.warehouseId
      );
    }
  }

  onLazyLoad(event: LazyLoadEvent) {
    // Prevent multiple simultaneous loads
    if (this.isLoading) {
      return;
    }
    this.lastLazyLoadEvent = event;
    this.isInitialLoad = false;
    // Defer loading to next tick to avoid change detection error
    setTimeout(() => {
      this.loadTransfers();
    }, 0);
  }

  async loadTransfers() {
    if (!this.lastLazyLoadEvent) {
      this.lastLazyLoadEvent = {
        first: 0,
        rows: this.pageSize,
        sortField: 'creationDate',
        sortOrder: -1
      };
    }

    const { first, rows, sortField, sortOrder } = this.lastLazyLoadEvent;
    const page = first! / rows!;
    const direction = sortOrder === -1 ? 'desc' : 'asc'; // Backend expects lowercase

    // Extract warehouse IDs properly - handle both object and number cases
    let sourceId: number | undefined = undefined;
    if (this.selectedSourceWarehouse) {
      if (typeof this.selectedSourceWarehouse === 'object') {
        sourceId = this.selectedSourceWarehouse.warehouseId || 
                   (this.selectedSourceWarehouse as any).value?.warehouseId ||
                   (this.selectedSourceWarehouse as any).value;
      } else if (typeof this.selectedSourceWarehouse === 'number') {
        sourceId = this.selectedSourceWarehouse;
      }
    }
    
    let destId: number | undefined = undefined;
    if (this.selectedDestinationWarehouse) {
      if (typeof this.selectedDestinationWarehouse === 'object') {
        destId = this.selectedDestinationWarehouse.warehouseId || 
                 (this.selectedDestinationWarehouse as any).value?.warehouseId ||
                 (this.selectedDestinationWarehouse as any).value;
      } else if (typeof this.selectedDestinationWarehouse === 'number') {
        destId = this.selectedDestinationWarehouse;
      }
    }
    
    // Format dates as yyyy-MM-dd strings or undefined (not empty strings)
    let startDateStr: string | undefined = undefined;
    let endDateStr: string | undefined = undefined;
    
    if (this.startDate) {
      startDateStr = this.formatDateForApi(this.startDate, true);
      if (!startDateStr || startDateStr === '') {
        startDateStr = undefined;
      }
    }
    
    if (this.endDate) {
      endDateStr = this.formatDateForApi(this.endDate, false);
      if (!endDateStr || endDateStr === '') {
        endDateStr = undefined;
      }
    }

    // Defer the entire loading operation to avoid change detection error
    setTimeout(async () => {
      this.isLoading = true;
      
      (await this.transferService.searchTransfers(
        page,
        rows!,
        sourceId,
        destId,
        this.selectedStatus || undefined,
        startDateStr,
        endDateStr,
        sortField || 'creationDate',
        direction
      )).subscribe({
        next: (response: any) => {
          this.transfers = (response.content || []).map((t: any) => ({
            ...t,
            transferDate: t.transferDate ? new Date(t.transferDate) : null,
            creationDate: t.creationDate ? new Date(t.creationDate) : null,
            initiatedDate: t.initiatedDate ? new Date(t.initiatedDate) : null,
            completedDate: t.completedDate ? new Date(t.completedDate) : null,
            cancelledDate: t.cancelledDate ? new Date(t.cancelledDate) : null
          }));
          this.totalRecords = response.totalElements || 0;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('Error loading transfers:', err);
          this.isLoading = false;
          this.cdr.markForCheck();
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_transfers'),
            life: 3000
          });
        }
      });
    }, 0);
  }

  formatDateForApi(date: Date, isStart: boolean): string {
    if (!date) return '';
    const d = new Date(date);
    // Format as ISO-8601 date-time (LocalDateTime format for backend)
    // Backend expects: @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = isStart ? '00' : '23';
    const minutes = isStart ? '00' : '59';
    const seconds = isStart ? '00' : '59';
    // Format: yyyy-MM-ddTHH:mm:ss (ISO-8601 date-time)
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  applyFilters() {
    this.lastLazyLoadEvent = {
      first: 0,
      rows: this.pageSize,
      sortField: 'creationDate',
      sortOrder: -1
    };
    this.loadTransfers();
  }

  resetFilters() {
    this.selectedSourceWarehouse = null;
    this.selectedDestinationWarehouse = null;
    this.selectedStatus = null;
    this.startDate = null;
    this.endDate = null;
    this.pageSize = 20;
    this.applyFilters();
  }

  clearFilters() {
    this.resetFilters();
  }

  onFilterChange() {
    // Apply filters when any filter changes
    this.applyFilters();
  }

  // Create Transfer Form Methods
  openNew() {
    // Initialize available warehouses when opening dialog
    this.updateAvailableWarehouses();
    if (this.hasSingleWarehouse) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('warehouse_transfer_single_warehouse_warning') || 'You cannot create transfers because only one warehouse exists.',
        life: 4000
      });
      return;
    }

    this.transfer = {};
    this.transferItems = [];
    this.sourceProducts = [];
    this.cachedWarehouseProducts = [];
    this.productSuggestionsMap.clear();
    this.productSuggestionsLoadingMap.clear();
    this.submitted = false;
    this.transfer.transferDate = new Date();
    this.transferDialog = true;
  }

  onSourceWarehouseChange() {
    // Clear destination warehouse if it's the same as source
    if (this.transfer.destinationWarehouse?.warehouseId === this.transfer.sourceWarehouse?.warehouseId) {
      this.transfer.destinationWarehouse = null as any;
    }
    
    // Update available warehouses lists
    this.updateAvailableWarehouses();
    
    // Reset products availability flag
    this.hasNoProductsInWarehouse = false;
    
    if (this.transfer.sourceWarehouse?.warehouseId) {
      this.loadSourceProducts();
    } else {
      this.sourceProducts = [];
      this.cachedWarehouseProducts = [];
    }
  }

  onDestinationWarehouseChange() {
    // Clear source warehouse if it's the same as destination
    if (this.transfer.sourceWarehouse?.warehouseId === this.transfer.destinationWarehouse?.warehouseId) {
      this.transfer.sourceWarehouse = null as any;
      this.sourceProducts = [];
    }
    
    // Update available warehouses lists
    this.updateAvailableWarehouses();
  }

  isSameWarehouseSelected(): boolean {
    return this.transfer.sourceWarehouse?.warehouseId === this.transfer.destinationWarehouse?.warehouseId &&
           this.transfer.sourceWarehouse?.warehouseId !== undefined;
  }

  async loadSourceProducts() {
    const warehouseId = this.transfer.sourceWarehouse?.warehouseId;
    if (!warehouseId) {
      this.sourceProducts = [];
      this.cachedWarehouseProducts = [];
      this.hasNoProductsInWarehouse = false;
      return;
    }

    try {
      // Load and cache warehouse products once when warehouse is selected
      // This allows efficient client-side filtering for autocomplete
      await this.warehouseService.loadToken();
      
      this.warehouseService.getProductsByWarehouse(warehouseId).subscribe({
        next: (response: any) => {
          const products = Array.isArray(response) ? response : (response?.content || []);
          // Cache products with available stock
          this.cachedWarehouseProducts = products.filter(
            (p: Product) => p.quantityAvailable && p.quantityAvailable > 0
          );
          
          // Check if warehouse has no available products
          this.hasNoProductsInWarehouse = this.cachedWarehouseProducts.length === 0;
          
          if (this.hasNoProductsInWarehouse) {
            this.messageService.add({
              severity: 'warn',
              summary: this.translate.instant('warning'),
              detail: this.translate.instant('source_warehouse_has_no_available_products'),
              life: 5000
            });
          }
          
          console.log(`Cached ${this.cachedWarehouseProducts.length} products for warehouse ${warehouseId}`);
        },
        error: (err: any) => {
          console.error('Error loading products for warehouse:', err);
          this.cachedWarehouseProducts = [];
          this.hasNoProductsInWarehouse = true;
        }
      });
    } catch (error) {
      console.error('Error loading products:', error);
      this.cachedWarehouseProducts = [];
      this.hasNoProductsInWarehouse = true;
    }
  }

  filterProductsForWarehouse(event: any, itemIndex: number): void {
    const query = (event?.query || '').trim().toLowerCase();

    // Check if warehouse products are cached, if not, load them first
    if (this.cachedWarehouseProducts.length === 0) {
      const warehouseId = this.transfer.sourceWarehouse?.warehouseId;
      if (warehouseId) {
        this.loadSourceProducts();
        // Wait a bit for products to load, then filter
        setTimeout(() => {
          this.filterProductsForWarehouse(event, itemIndex);
        }, 100);
        return;
      }
    }

    // Use cached warehouse products and filter client-side for instant response
    // This is efficient and doesn't require server calls on every keystroke
    let filteredProducts = [...this.cachedWarehouseProducts];

    if (query) {
      filteredProducts = filteredProducts.filter((p: Product) => {
        const nameMatch = p.name?.toLowerCase().includes(query);
        const refMatch = p.reference?.toLowerCase().includes(query);
        return nameMatch || refMatch;
      });
    }

    // Exclude already selected products in other items
    const selectedProductIds = new Set(
      this.transferItems
        .filter((item, idx) => idx !== itemIndex && item.product?.productId)
        .map(item => item.product!.productId)
    );

    filteredProducts = filteredProducts.filter(
      (p: Product) => !selectedProductIds.has(p.productId!)
    );

    // Limit to first 50 results for performance
    this.productSuggestionsMap.set(itemIndex, filteredProducts.slice(0, 50));
    this.productSuggestionsLoadingMap.set(itemIndex, false);
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

    return [];
  }

  addTransferItem() {
    const newItem: TransferItem = {
      product: null as any,
      quantity: 1,
      notes: ''
    };
    this.transferItems.push(newItem);
  }

  removeTransferItem(index: number) {
    this.transferItems.splice(index, 1);
  }

  onProductSelected(item: TransferItem, event: any, itemIndex: number): void {
    // PrimeNG autocomplete passes the selected product in event.value
    const selectedProduct = event?.value || event;
    if (selectedProduct && selectedProduct.productId) {
      item.product = selectedProduct;
      // Clear the suggestions for this item after selection
      this.productSuggestionsMap.delete(itemIndex);
    }
  }

  getProductSuggestions(itemIndex: number): Product[] {
    return this.productSuggestionsMap.get(itemIndex) || [];
  }

  isProductSuggestionsLoading(itemIndex: number): boolean {
    return this.productSuggestionsLoadingMap.get(itemIndex) || false;
  }

  getAvailableStock(product: Product | undefined): number {
    return product?.quantityAvailable || 0;
  }

  validateQuantity(item: TransferItem): boolean {
    if (!item.product || !item.quantity) return false;
    const available = this.getAvailableStock(item.product);
    return item.quantity > 0 && item.quantity <= available;
  }

  getQuantityError(item: TransferItem): string {
    if (!item.product) return '';
    const available = this.getAvailableStock(item.product);
    if (item.quantity && item.quantity > available) {
      return this.translate.instant('insufficient_stock', {
        available,
        required: item.quantity,
        product: item.product.name
      });
    }
    return '';
  }

  calculateTotalQuantity(): number {
    return this.transferItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }

  async saveTransfer() {
    this.submitted = true;

    if (!this.transfer.sourceWarehouse) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('source_warehouse_required'),
        life: 3000
      });
      return;
    }

    if (!this.transfer.destinationWarehouse) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('destination_warehouse_required'),
        life: 3000
      });
      return;
    }

    const sourceId = this.transfer.sourceWarehouse?.warehouseId;
    const destId = this.transfer.destinationWarehouse?.warehouseId;

    if (sourceId === destId) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('source_destination_must_differ'),
        life: 3000
      });
      return;
    }

    // Check if source warehouse has available products
    if (this.hasNoProductsInWarehouse || this.cachedWarehouseProducts.length === 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('source_warehouse_has_no_available_products'),
        life: 3000
      });
      return;
    }

    if (this.transferItems.length === 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('at_least_one_item_required'),
        life: 3000
      });
      return;
    }

    for (const item of this.transferItems) {
      if (!item.product || !item.product.productId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('product_required_for_all_items'),
          life: 3000
        });
        return;
      }

      if (!this.validateQuantity(item)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.getQuantityError(item) || this.translate.instant('invalid_quantity'),
          life: 3000
        });
        return;
      }
    }

    const transferToSave: WarehouseTransfer = {
      sourceWarehouse: this.transfer.sourceWarehouse,
      destinationWarehouse: this.transfer.destinationWarehouse,
      transferItems: this.transferItems,
      transferDate: this.transfer.transferDate,
      notes: this.transfer.notes
    };

    this.isSaving = true;

    try {
      (await this.transferService.createTransfer(transferToSave)).subscribe({
        next: (response: WarehouseTransfer) => {
          this.isSaving = false;
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('transfer_created_successfully'),
            life: 3000
          });
          this.transferDialog = false;
          this.loadTransfers();
          if (response.transferId) {
            this.viewTransferDetails(response);
          }
        },
        error: (err: any) => {
          this.isSaving = false;
          console.error('Error creating transfer:', err);
          let errorMessage = this.translate.instant('error_creating_transfer');
          
          if (err.error?.message) {
            errorMessage = err.error.message;
          } else if (err.status === 400) {
            errorMessage = this.translate.instant('validation_error') + ': ' + (err.error?.message || 'Invalid data');
          } else if (err.status === 404) {
            errorMessage = this.translate.instant('warehouse_or_product_not_found');
          }

          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: errorMessage,
            life: 5000
          });
        }
      });
    } catch (error) {
      this.isSaving = false;
      console.error('Error creating transfer:', error);
    }
  }

  // Detail View Methods
  viewTransferDetails(transfer: WarehouseTransfer) {
    if (!transfer.transferId) return;
    this.router.navigate(['/inventory/warehouse-transfers', transfer.transferId]);
  }


  // Action Methods
  openInitiateConfirm(transfer: WarehouseTransfer) {
    this.selectedTransfer = transfer;
    this.initiateConfirmDialog = true;
  }

  async confirmInitiate() {
    if (!this.selectedTransfer?.transferId) return;

    this.isLoading = true;
    (await this.transferService.initiateTransfer(this.selectedTransfer.transferId)).subscribe({
      next: (response: WarehouseTransfer) => {
        this.isLoading = false;
        this.initiateConfirmDialog = false;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('transfer_initiated_successfully'),
          life: 3000
        });
        this.loadTransfers();
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Error initiating transfer:', err);
        let errorMessage = this.translate.instant('error_initiating_transfer');
        
        if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.status === 400) {
          errorMessage = this.translate.instant('cannot_initiate_transfer') + ': ' + (this.selectedTransfer.status || 'Unknown status');
        }

        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: errorMessage,
          life: 5000
        });
      }
    });
  }

  openCompleteConfirm(transfer: WarehouseTransfer) {
    this.selectedTransfer = transfer;
    this.completeConfirmDialog = true;
  }

  async confirmComplete() {
    if (!this.selectedTransfer?.transferId) return;

    this.isLoading = true;
    (await this.transferService.completeTransfer(this.selectedTransfer.transferId)).subscribe({
      next: (response: WarehouseTransfer) => {
        this.isLoading = false;
        this.completeConfirmDialog = false;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('transfer_completed_successfully'),
          life: 3000
        });
        this.loadTransfers();
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Error completing transfer:', err);
        let errorMessage = this.translate.instant('error_completing_transfer');
        
        if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.status === 400) {
          errorMessage = this.translate.instant('cannot_complete_transfer') + ': ' + (this.selectedTransfer.status || 'Unknown status');
        }

        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: errorMessage,
          life: 5000
        });
      }
    });
  }

  openCancelConfirm(transfer: WarehouseTransfer) {
    this.selectedTransfer = transfer;
    this.cancelConfirmDialog = true;
  }

  async confirmCancel() {
    if (!this.selectedTransfer?.transferId) return;

    this.isLoading = true;
    (await this.transferService.cancelTransfer(this.selectedTransfer.transferId)).subscribe({
      next: (response: WarehouseTransfer) => {
        this.isLoading = false;
        this.cancelConfirmDialog = false;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('transfer_cancelled_successfully'),
          life: 3000
        });
        this.loadTransfers();
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Error cancelling transfer:', err);
        let errorMessage = this.translate.instant('error_cancelling_transfer');
        
        if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.status === 400) {
          errorMessage = this.translate.instant('cannot_cancel_completed_transfer');
        }

        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: errorMessage,
          life: 5000
        });
      }
    });
  }

  // Status helpers
  getStatusSeverity(status: string | undefined): string {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s === 'PENDING') return 'warning';
    if (s === 'IN_TRANSIT') return 'info';
    if (s === 'COMPLETED') return 'success';
    if (s === 'CANCELLED') return 'danger';
    return '';
  }

  getStatusIcon(status: string | undefined): string {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s === 'PENDING') return 'pi pi-clock';
    if (s === 'IN_TRANSIT') return 'pi pi-truck';
    if (s === 'COMPLETED') return 'pi pi-check-circle';
    if (s === 'CANCELLED') return 'pi pi-times-circle';
    return '';
  }

  canInitiate(transfer: WarehouseTransfer): boolean {
    return transfer.status === 'PENDING' && this.canEditTransfer;
  }

  canComplete(transfer: WarehouseTransfer): boolean {
    return transfer.status === 'IN_TRANSIT' && this.canEditTransfer;
  }

  canCancel(transfer: WarehouseTransfer): boolean {
    return (transfer.status === 'PENDING' || transfer.status === 'IN_TRANSIT') && this.canEditTransfer;
  }

  hasBatchInfo(transfer: WarehouseTransfer): boolean {
    return transfer.transferItems?.some(item => 
      BatchMetadataUtil.hasBatchMetadata(item.batchMetadata)
    ) ?? false;
  }

  getItemsCount(transfer: WarehouseTransfer): number {
    return transfer.transferItems?.length || 0;
  }

  getTotalQuantity(transfer: WarehouseTransfer): number {
    return transfer.transferItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
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
      
      // Fetch all filtered transfers from backend using current filter parameters
      const { sortField, sortOrder } = this.lastLazyLoadEvent || { sortField: 'creationDate', sortOrder: -1 };
      const direction = sortOrder === -1 ? 'DESC' : 'ASC'; // Backend expects uppercase
      
      // Extract warehouse IDs properly
      let sourceId: number | undefined = undefined;
      if (this.selectedSourceWarehouse) {
        if (typeof this.selectedSourceWarehouse === 'object') {
          sourceId = this.selectedSourceWarehouse.warehouseId || 
                     (this.selectedSourceWarehouse as any).value?.warehouseId ||
                     (this.selectedSourceWarehouse as any).value;
        } else if (typeof this.selectedSourceWarehouse === 'number') {
          sourceId = this.selectedSourceWarehouse;
        }
      }
      
      let destId: number | undefined = undefined;
      if (this.selectedDestinationWarehouse) {
        if (typeof this.selectedDestinationWarehouse === 'object') {
          destId = this.selectedDestinationWarehouse.warehouseId || 
                   (this.selectedDestinationWarehouse as any).value?.warehouseId ||
                   (this.selectedDestinationWarehouse as any).value;
        } else if (typeof this.selectedDestinationWarehouse === 'number') {
          destId = this.selectedDestinationWarehouse;
        }
      }
      
      // Format dates
      let startDateStr: string | undefined = undefined;
      let endDateStr: string | undefined = undefined;
      
      if (this.startDate) {
        startDateStr = this.formatDateForApi(this.startDate, true);
        if (!startDateStr || startDateStr === '') {
          startDateStr = undefined;
        }
      }
      
      if (this.endDate) {
        endDateStr = this.formatDateForApi(this.endDate, false);
        if (!endDateStr || endDateStr === '') {
          endDateStr = undefined;
        }
      }
      
      // Fetch all transfers with pagination loop
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredTransfers: any[] = [];
      let currentPage = 0;
      const pageSize = 1000; // Fetch in chunks of 1000
      let hasMore = true;
      let totalElements = 0;
      
      while (hasMore) {
        const pageResponse: any = await firstValueFrom(
          await this.transferService.searchTransfers(
            currentPage,
            pageSize,
            sourceId,
            destId,
            this.selectedStatus || undefined,
            startDateStr,
            endDateStr,
            sortField || 'creationDate',
            direction
          )
        );
        
        const pageContent = pageResponse?.content || [];
        allFilteredTransfers = allFilteredTransfers.concat(pageContent);
        totalElements = pageResponse?.totalElements || 0;
        
        // Update progress
        const progressPercent = totalElements > 0 
          ? Math.min(100, Math.round((allFilteredTransfers.length / totalElements) * 100))
          : 0;
        this.exportProgress = `${this.translate.instant('fetching_data') || 'Fetching data'}... ${allFilteredTransfers.length} / ${totalElements} (${progressPercent}%)`;
        this.cdr.detectChanges(); // Update UI with progress
        
        // Check if there are more pages
        const totalPages = pageResponse?.totalPages || 0;
        hasMore = currentPage + 1 < totalPages && allFilteredTransfers.length < totalElements;
        currentPage++;
        
        // Safety limit to prevent infinite loops
        if (currentPage > 100) {
          console.warn('Export stopped at 100 pages to prevent excessive data fetching');
          break;
        }
      }
      
      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';
      this.cdr.detectChanges();
      
      // Extract transfers from response
      const filteredTransfers = allFilteredTransfers.map((t: any) => ({
        ...t,
        transferDate: t.transferDate ? new Date(t.transferDate) : null,
        creationDate: t.creationDate ? new Date(t.creationDate) : null,
        initiatedDate: t.initiatedDate ? new Date(t.initiatedDate) : null,
        completedDate: t.completedDate ? new Date(t.completedDate) : null,
        cancelledDate: t.cancelledDate ? new Date(t.cancelledDate) : null
      }));
      
      // Prepare transfers for export with calculated fields
      const exportData = filteredTransfers.map(transfer => ({
        reference: transfer.reference || '',
        sourceWarehouseName: transfer.sourceWarehouse?.name || 'N/A',
        destinationWarehouseName: transfer.destinationWarehouse?.name || 'N/A',
        status: transfer.status ? this.translate.instant(`transfer_status_${transfer.status.toLowerCase()}`) : 'N/A',
        itemsCount: this.getItemsCount(transfer),
        totalQuantity: this.getTotalQuantity(transfer),
        batchInfo: this.hasBatchInfo(transfer) ? this.translate.instant('batch_tracked') : this.translate.instant('no'),
        createdBy: transfer.createdBy || 'N/A'
      }));
      
      // Build translated export columns based on organization's default locale
      const translationKeyMap: { [key: string]: string } = {
        'reference': 'reference',
        'sourceWarehouseName': 'source_warehouse',
        'destinationWarehouseName': 'destination_warehouse',
        'status': 'status',
        'itemsCount': 'items_count',
        'totalQuantity': 'total_quantity',
        'batchInfo': 'batch_info',
        'createdBy': 'created_by'
      };
      
      const translatedExportColumns: ExportColumn[] = this.exportColumns.map((col) => {
        const translationKey = translationKeyMap[col.dataKey] || col.dataKey;
        return {
          title: this.translate.instant(translationKey),
          dataKey: col.dataKey
        };
      });
      
      // Get translated title for PDF
      const pdfTitle = this.translate.instant('warehouse_transfers_menu_title');
      
      // Export with translated headers and title
      this.reportingService.exportPdf(translatedExportColumns, exportData, 'warehouse-transfers', pdfTitle);
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${exportData.length} records exported.`,
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
      
      // Fetch all filtered transfers from backend using current filter parameters
      const { sortField, sortOrder } = this.lastLazyLoadEvent || { sortField: 'creationDate', sortOrder: -1 };
      const direction = sortOrder === -1 ? 'DESC' : 'ASC'; // Backend expects uppercase
      
      // Extract warehouse IDs properly
      let sourceId: number | undefined = undefined;
      if (this.selectedSourceWarehouse) {
        if (typeof this.selectedSourceWarehouse === 'object') {
          sourceId = this.selectedSourceWarehouse.warehouseId || 
                     (this.selectedSourceWarehouse as any).value?.warehouseId ||
                     (this.selectedSourceWarehouse as any).value;
        } else if (typeof this.selectedSourceWarehouse === 'number') {
          sourceId = this.selectedSourceWarehouse;
        }
      }
      
      let destId: number | undefined = undefined;
      if (this.selectedDestinationWarehouse) {
        if (typeof this.selectedDestinationWarehouse === 'object') {
          destId = this.selectedDestinationWarehouse.warehouseId || 
                   (this.selectedDestinationWarehouse as any).value?.warehouseId ||
                   (this.selectedDestinationWarehouse as any).value;
        } else if (typeof this.selectedDestinationWarehouse === 'number') {
          destId = this.selectedDestinationWarehouse;
        }
      }
      
      // Format dates
      let startDateStr: string | undefined = undefined;
      let endDateStr: string | undefined = undefined;
      
      if (this.startDate) {
        startDateStr = this.formatDateForApi(this.startDate, true);
        if (!startDateStr || startDateStr === '') {
          startDateStr = undefined;
        }
      }
      
      if (this.endDate) {
        endDateStr = this.formatDateForApi(this.endDate, false);
        if (!endDateStr || endDateStr === '') {
          endDateStr = undefined;
        }
      }
      
      // Fetch all transfers with pagination loop
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredTransfers: any[] = [];
      let currentPage = 0;
      const pageSize = 1000; // Fetch in chunks of 1000
      let hasMore = true;
      let totalElements = 0;
      
      while (hasMore) {
        const pageResponse: any = await firstValueFrom(
          await this.transferService.searchTransfers(
            currentPage,
            pageSize,
            sourceId,
            destId,
            this.selectedStatus || undefined,
            startDateStr,
            endDateStr,
            sortField || 'creationDate',
            direction
          )
        );
        
        const pageContent = pageResponse?.content || [];
        allFilteredTransfers = allFilteredTransfers.concat(pageContent);
        totalElements = pageResponse?.totalElements || 0;
        
        // Update progress
        const progressPercent = totalElements > 0 
          ? Math.min(100, Math.round((allFilteredTransfers.length / totalElements) * 100))
          : 0;
        this.exportProgress = `${this.translate.instant('fetching_data') || 'Fetching data'}... ${allFilteredTransfers.length} / ${totalElements} (${progressPercent}%)`;
        this.cdr.detectChanges(); // Update UI with progress
        
        // Check if there are more pages
        const totalPages = pageResponse?.totalPages || 0;
        hasMore = currentPage + 1 < totalPages && allFilteredTransfers.length < totalElements;
        currentPage++;
        
        // Safety limit to prevent infinite loops
        if (currentPage > 100) {
          console.warn('Export stopped at 100 pages to prevent excessive data fetching');
          break;
        }
      }
      
      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';
      this.cdr.detectChanges();
      
      // Extract transfers from response
      const filteredTransfers = allFilteredTransfers.map((t: any) => ({
        ...t,
        transferDate: t.transferDate ? new Date(t.transferDate) : null,
        creationDate: t.creationDate ? new Date(t.creationDate) : null,
        initiatedDate: t.initiatedDate ? new Date(t.initiatedDate) : null,
        completedDate: t.completedDate ? new Date(t.completedDate) : null,
        cancelledDate: t.cancelledDate ? new Date(t.cancelledDate) : null
      }));
      
      // Prepare transfers for export with calculated fields and translated headers
      const exportData = filteredTransfers.map(transfer => {
        const translated: any = {};
        translated[this.translate.instant('reference')] = transfer.reference || '';
        translated[this.translate.instant('source_warehouse')] = transfer.sourceWarehouse?.name || 'N/A';
        translated[this.translate.instant('destination_warehouse')] = transfer.destinationWarehouse?.name || 'N/A';
        translated[this.translate.instant('status')] = transfer.status ? this.translate.instant(`transfer_status_${transfer.status.toLowerCase()}`) : 'N/A';
        translated[this.translate.instant('items_count')] = this.getItemsCount(transfer);
        translated[this.translate.instant('total_quantity')] = this.getTotalQuantity(transfer);
        translated[this.translate.instant('batch_info')] = this.hasBatchInfo(transfer) ? this.translate.instant('batch_tracked') : this.translate.instant('no');
        translated[this.translate.instant('created_by')] = transfer.createdBy || 'N/A';
        return translated;
      });
      
      // Export the translated array to Excel
      this.reportingService.exportExcel(exportData, 'warehouse-transfers');
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${exportData.length} records exported.`,
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
}
