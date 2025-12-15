import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { LazyLoadEvent, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Router } from '@angular/router';
import { StockMovement, StockMovementType } from 'src/app/models/stockMovement';
import { StockMovementService } from 'src/app/services/stock-movement.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { ProductService } from 'src/app/services/product.service';
import { Warehouse } from 'src/app/models/warehouse';
import { Product } from 'src/app/models/product';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';

@Component({
  templateUrl: './stock-movements.component.html',
  styleUrls: ['./stock-movements.component.css', '../inventory.component.css'],
  providers: [MessageService]
})
export class StockMovementsComponent implements OnInit {
  @ViewChild('dt') table!: Table;

  // List view
  movements: StockMovement[] = [];
  isLoading: boolean = false;
  totalRecords: number = 0;
  lastLazyLoadEvent?: LazyLoadEvent;
  
  // Filters
  selectedProduct: any = null;
  selectedWarehouse: any = null;
  selectedMovementType: string | null = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  pageSize: number = 20;
  pageSizeOptions = [20, 50, 100];
  
  // Dropdowns
  products: any[] = [];
  warehouses: any[] = [];
  movementTypeOptions: any[] = [];
  
  // Permissions
  canReadMovement: boolean = false;
  
  resource: string = 'STOCK_MOVEMENTS';

  constructor(
    private movementService: StockMovementService,
    private warehouseService: WarehouseService,
    private productService: ProductService,
    private messageService: MessageService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private router: Router,
    private permissionService: PermissionService,
    private keycloakService: KeycloakService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.setPermissions();
    await this.initializeTranslations();
    await this.loadInitialData();
  }

  async setPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canReadMovement = this.permissionService.canRead(this.resource);
  }

  async initializeTranslations() {
    this.translateService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang);
    });

    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe((translations) => {
      this.movementTypeOptions = [
        { label: translations['stock_movement_type_purchase'] || 'Purchase', value: 'PURCHASE' },
        { label: translations['stock_movement_type_sale'] || 'Sale', value: 'SALE' },
        { label: translations['stock_movement_type_transfer_in'] || 'Transfer In', value: 'TRANSFER_IN' },
        { label: translations['stock_movement_type_transfer_out'] || 'Transfer Out', value: 'TRANSFER_OUT' },
        { label: translations['stock_movement_type_adjustment'] || 'Adjustment', value: 'ADJUSTMENT' },
        { label: translations['stock_movement_type_return'] || 'Return', value: 'RETURN' },
        { label: translations['stock_movement_type_damage'] || 'Damage', value: 'DAMAGE' },
        { label: translations['stock_movement_type_expiry'] || 'Expiry', value: 'EXPIRY' }
      ];
    });
  }

  async loadInitialData() {
    await this.loadWarehouses();
    await this.loadProducts();
    // Don't call loadMovements() here - let the table's lazy load event handle the initial load
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

  async loadProducts() {
    try {
      this.productService.getProducts().subscribe({
        next: (response: any) => {
          const productsList = Array.isArray(response) ? response : (response?.content || []);
          this.products = productsList.map((p: Product) => ({
            label: `${p.reference || ''} - ${p.name || ''}`,
            value: p.productId,
            product: p
          })).slice(0, 100); // Limit to first 100 for performance
        },
        error: (err: any) => {
          console.error('Error loading products:', err);
        }
      });
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }

  onLazyLoad(event: LazyLoadEvent) {
    // Prevent multiple simultaneous loads
    if (this.isLoading) {
      return;
    }
    this.lastLazyLoadEvent = event;
    // Defer loading to next tick to avoid change detection error
    setTimeout(() => {
      this.loadMovements();
    }, 0);
  }

  async loadMovements() {
    if (!this.lastLazyLoadEvent) {
      this.lastLazyLoadEvent = {
        first: 0,
        rows: this.pageSize,
        sortField: 'movementDate',
        sortOrder: -1
      };
    }

    const { first, rows } = this.lastLazyLoadEvent;
    const page = first! / rows!;
    // Note: Backend hardcodes sort to DESC by movementDate, so we don't send sort parameters

    // Extract IDs properly - handle both object and number cases
    let productId: number | undefined = undefined;
    if (this.selectedProduct) {
      if (typeof this.selectedProduct === 'object') {
        productId = this.selectedProduct.productId || 
                   (this.selectedProduct as any).value?.productId ||
                   (this.selectedProduct as any).value;
      } else if (typeof this.selectedProduct === 'number') {
        productId = this.selectedProduct;
      }
    }
    
    let warehouseId: number | undefined = undefined;
    if (this.selectedWarehouse) {
      if (typeof this.selectedWarehouse === 'object') {
        warehouseId = this.selectedWarehouse.warehouseId || 
                     (this.selectedWarehouse as any).value?.warehouseId ||
                     (this.selectedWarehouse as any).value;
      } else if (typeof this.selectedWarehouse === 'number') {
        warehouseId = this.selectedWarehouse;
      }
    }
    
    // Format dates as ISO-8601 date-time strings or undefined (not empty strings)
    // Backend expects 'start' and 'end' parameters (not 'startDate' and 'endDate')
    let startStr: string | undefined = undefined;
    let endStr: string | undefined = undefined;
    
    if (this.startDate) {
      startStr = this.formatDateForApi(this.startDate, true);
      if (!startStr || startStr === '') {
        startStr = undefined;
      }
    }
    
    if (this.endDate) {
      endStr = this.formatDateForApi(this.endDate, false);
      if (!endStr || endStr === '') {
        endStr = undefined;
      }
    }

    // Defer the entire loading operation to avoid change detection error
    setTimeout(async () => {
      this.isLoading = true;
      
      // Backend doesn't support movementType, sortBy, or sortDirection parameters
      // Sorting is hardcoded to DESC by movementDate on the backend
      (await this.movementService.getStockMovements(
        page,
        rows!,
        productId,
        warehouseId,
        startStr,
        endStr
      )).subscribe({
        next: (response: any) => {
          // Map backend DTO fields to model fields
          this.movements = (response.content || []).map((dto: any) => ({
            movementId: dto.id,
            product: dto.productId ? {
              productId: dto.productId,
              reference: dto.productReference,
              name: dto.productName
            } : undefined,
            warehouse: dto.warehouseId ? {
              warehouseId: dto.warehouseId,
              name: dto.warehouseName
            } : undefined,
            movementType: dto.type,
            quantity: dto.quantityChange,
            previousQuantity: dto.quantityBefore,
            newQuantity: dto.quantityAfter,
            sourceDocumentType: dto.sourceType,
            sourceDocumentId: dto.sourceId,
            reference: dto.sourceReference,
            movementDate: dto.movementDate ? new Date(dto.movementDate) : null,
            performedBy: dto.performedByName,
            creationDate: dto.movementDate ? new Date(dto.movementDate) : null
          }));
          this.totalRecords = response.totalElements || 0;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('Error loading movements:', err);
          this.isLoading = false;
          this.cdr.markForCheck();
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_stock_movements'),
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
      sortField: 'movementDate',
      sortOrder: -1
    };
    this.loadMovements();
  }

  resetFilters() {
    this.selectedProduct = null;
    this.selectedWarehouse = null;
    this.selectedMovementType = null;
    this.startDate = null;
    this.endDate = null;
    this.pageSize = 20;
    this.applyFilters();
  }

  // Navigation to source documents
  navigateToSourceDocument(movement: StockMovement) {
    if (!movement.sourceDocumentType || !movement.sourceDocumentId) {
      return;
    }

    switch (movement.sourceDocumentType) {
      case 'PURCHASE':
        if (movement.purchase?.purchaseId) {
          this.router.navigate(['/inventory/purchases'], {
            queryParams: { id: movement.purchase.purchaseId }
          });
        }
        break;
      case 'ORDER':
        if (movement.order?.orderId) {
          this.router.navigate(['/sales/orders'], {
            queryParams: { id: movement.order.orderId }
          });
        }
        break;
      case 'WAREHOUSE_TRANSFER':
        if (movement.warehouseTransfer?.transferId) {
          this.router.navigate(['/inventory/warehouse-transfers'], {
            queryParams: { id: movement.warehouseTransfer.transferId }
          });
        }
        break;
      default:
        console.log('Unknown source document type:', movement.sourceDocumentType);
    }
  }

  // Status helpers
  getMovementTypeSeverity(type: string | undefined): string {
    if (!type) return '';
    const t = type.toUpperCase();
    if (t === 'PURCHASE' || t === 'TRANSFER_IN' || t === 'RETURN') return 'success';
    if (t === 'SALE' || t === 'TRANSFER_OUT') return 'info';
    if (t === 'ADJUSTMENT') return 'warning';
    if (t === 'DAMAGE' || t === 'EXPIRY') return 'danger';
    return '';
  }

  getMovementTypeIcon(type: string | undefined): string {
    if (!type) return '';
    const t = type.toUpperCase();
    if (t === 'PURCHASE') return 'pi pi-shopping-cart';
    if (t === 'SALE') return 'pi pi-shopping-bag';
    if (t === 'TRANSFER_IN') return 'pi pi-arrow-down';
    if (t === 'TRANSFER_OUT') return 'pi pi-arrow-up';
    if (t === 'ADJUSTMENT') return 'pi pi-refresh';
    if (t === 'RETURN') return 'pi pi-replay';
    if (t === 'DAMAGE') return 'pi pi-exclamation-triangle';
    if (t === 'EXPIRY') return 'pi pi-calendar-times';
    return 'pi pi-circle';
  }

  getQuantityDisplay(movement: StockMovement): string {
    const quantity = movement.quantity || 0;
    const type = movement.movementType?.toUpperCase();
    if (type === 'PURCHASE' || type === 'TRANSFER_IN' || type === 'RETURN') {
      return `+${quantity}`;
    }
    if (type === 'SALE' || type === 'TRANSFER_OUT' || type === 'DAMAGE' || type === 'EXPIRY') {
      return `-${quantity}`;
    }
    return quantity > 0 ? `+${quantity}` : `${quantity}`;
  }

  hasSourceDocument(movement: StockMovement): boolean {
    return !!(movement.sourceDocumentType && movement.sourceDocumentId);
  }
}

