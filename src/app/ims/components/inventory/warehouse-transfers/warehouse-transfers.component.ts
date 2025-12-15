import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { LazyLoadEvent, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Router, ActivatedRoute } from '@angular/router';
import { WarehouseTransfer, TransferItem, TransferStatus } from 'src/app/models/warehouseTransfer';
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
  statusOptions: any[] = [];
  
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
    private router: Router
  ) {}

  async ngOnInit() {
    await this.setPermissions();
    await this.setUserRoles();
    await this.initializeTranslations();
    await this.loadInitialData();
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
        },
        error: (err: any) => {
          console.error('Error loading warehouses:', err);
        }
      });
    } catch (error) {
      console.error('Error loading warehouses:', error);
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

  // Create Transfer Form Methods
  openNew() {
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
    if (this.transfer.sourceWarehouse?.warehouseId) {
      this.loadSourceProducts();
    } else {
      this.sourceProducts = [];
    }
  }

  async loadSourceProducts() {
    const warehouseId = this.transfer.sourceWarehouse?.warehouseId;
    if (!warehouseId) {
      this.sourceProducts = [];
      this.cachedWarehouseProducts = [];
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
          console.log(`Cached ${this.cachedWarehouseProducts.length} products for warehouse ${warehouseId}`);
        },
        error: (err: any) => {
          console.error('Error loading products for warehouse:', err);
          this.cachedWarehouseProducts = [];
        }
      });
    } catch (error) {
      console.error('Error loading products:', error);
      this.cachedWarehouseProducts = [];
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
      product: {} as Product,
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

  getItemsCount(transfer: WarehouseTransfer): number {
    return transfer.transferItems?.length || 0;
  }

  getTotalQuantity(transfer: WarehouseTransfer): number {
    return transfer.transferItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  }
}
