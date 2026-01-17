import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { LazyLoadEvent, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Router } from '@angular/router';
import { InventoryWriteOff, WriteOffStatus, WriteOffSourceType } from 'src/app/models/write-off';
import { WriteOffService } from 'src/app/services/write-off.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { ProductService } from 'src/app/services/product.service';
import { Warehouse } from 'src/app/models/warehouse';
import { Product } from 'src/app/models/product';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { DatePipe } from '@angular/common';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';

@Component({
  templateUrl: './write-offs.component.html',
  styleUrls: ['./write-offs.component.css', '../inventory.component.css'],
  providers: [MessageService, DatePipe]
})
export class WriteOffsComponent implements OnInit {
  @ViewChild('dt') table!: Table;

  // List view
  writeOffs: InventoryWriteOff[] = [];
  selectedWriteOffs: InventoryWriteOff[] = [];
  isLoading: boolean = false;
  totalRecords: number = 0;
  lastLazyLoadEvent?: LazyLoadEvent;
  isInitialLoad: boolean = true;
  
  // Filters
  selectedProduct: any = null;
  selectedWarehouse: any = null;
  selectedCondition: string | null = null;
  selectedSourceType: string | null = null;
  selectedStatus: string | null = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  pageSize: number = 20;
  pageSizeOptions = [20, 50, 100];
  
  // Dropdowns
  warehouses: any[] = [];
  products: any[] = [];
  statusOptions: any[] = [];
  conditionOptions: any[] = [];
  sourceTypeOptions: any[] = [];

  // Detail view (for confirmation dialogs)
  selectedWriteOff: InventoryWriteOff = {
    quantity: 0,
    condition: '' as any,
    sourceType: '' as any
  };

  // Confirmation dialogs
  approveConfirmDialog: boolean = false;
  rejectConfirmDialog: boolean = false;

  rejectionReason: string = '';
  
  // Permissions
  canCreateWriteOff: boolean = false;
  canApproveWriteOff: boolean = false;
  canReadWriteOff: boolean = false;
  canReadProduct: boolean = false;
  canReadWarehouse: boolean = false;
  isAdmin: boolean = false;
  
  // Currency
  currency: string = 'USD';
  
  resource: string = 'INVENTORY_WRITE_OFFS';

  constructor(
    private writeOffService: WriteOffService,
    private warehouseService: WarehouseService,
    private productService: ProductService,
    private messageService: MessageService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private keycloakService: KeycloakService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private configService: AppConfigurationService
  ) {}

  async ngOnInit() {
    // Load currency
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    await this.configService.loadCurrencyOnce();
    
    await this.setPermissions();
    await this.setUserRoles();
    await this.initializeTranslations();
    await this.loadInitialData();
  }

  async setUserRoles() {
    const roles = await this.keycloakService.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
    // Admins can approve write-offs
    this.canApproveWriteOff = this.isAdmin || roles.includes('WRITE_OFF_APPROVE');
  }

  async setPermissions() {
    try {
      const profile = await this.keycloakService.loadUserProfile();
      const userId = profile.id;
      await this.permissionService.init(userId).toPromise();
      this.canCreateWriteOff = this.permissionService.canCreate(this.resource);
      this.canReadWriteOff = this.permissionService.canRead(this.resource);
      this.canReadProduct = this.permissionService.canRead('PRODUCTS');
      this.canReadWarehouse = this.permissionService.canRead('WAREHOUSES');
    } catch (error) {
      console.error('Error setting permissions:', error);
    }
  }

  async initializeTranslations() {
    this.translateService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang);
    });

    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe((translations) => {
      this.statusOptions = [
        { label: translations['write_off_status_pending'] || 'PENDING', value: 'PENDING' },
        { label: translations['write_off_status_approved'] || 'APPROVED', value: 'APPROVED' },
        { label: translations['write_off_status_rejected'] || 'REJECTED', value: 'REJECTED' }
      ];
      
      this.conditionOptions = [
        { label: translations['item_condition_damaged'] || 'DAMAGED', value: 'DAMAGED' },
        { label: translations['item_condition_unusable'] || 'UNUSABLE', value: 'UNUSABLE' },
        { label: translations['item_condition_lost'] || 'LOST', value: 'LOST' },
        { label: translations['item_condition_expired'] || 'EXPIRED', value: 'EXPIRED' }
      ];
      
      this.sourceTypeOptions = [
        { label: translations['write_off_source_type_order_return'] || 'ORDER_RETURN', value: 'ORDER_RETURN' },
        { label: translations['write_off_source_type_purchase_return'] || 'PURCHASE_RETURN', value: 'PURCHASE_RETURN' },
        { label: translations['write_off_source_type_manual_adjustment'] || 'MANUAL_ADJUSTMENT', value: 'MANUAL_ADJUSTMENT' },
        { label: translations['write_off_source_type_expiration'] || 'EXPIRATION', value: 'EXPIRATION' },
        { label: translations['write_off_source_type_damage_incident'] || 'DAMAGE_INCIDENT', value: 'DAMAGE_INCIDENT' },
        { label: translations['write_off_source_type_theft'] || 'THEFT', value: 'THEFT' },
        { label: translations['write_off_source_type_quality_control'] || 'QUALITY_CONTROL', value: 'QUALITY_CONTROL' }
      ];
    });
  }

  async loadInitialData() {
    await this.loadWarehouses();
    await this.loadProducts();
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
      // Load a list of products for filtering (could be limited/paginated)
      this.productService.getProductsPaginated(0, 1000).subscribe({
        next: (response: any) => {
          const productsList = Array.isArray(response) ? response : (response?.content || []);
          this.products = productsList.map((p: Product) => ({
            label: `${p.name} (${p.reference})`,
            value: p.productId,
            product: p
          }));
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
    if (this.isLoading) {
      return;
    }
    this.lastLazyLoadEvent = event;
    this.isInitialLoad = false;
    setTimeout(() => {
      this.loadWriteOffs();
    }, 0);
  }

  async loadWriteOffs() {
    if (!this.lastLazyLoadEvent) {
      this.lastLazyLoadEvent = {
        first: 0,
        rows: this.pageSize,
        sortField: 'writeOffDate',
        sortOrder: -1
      };
    }

    const { first, rows, sortField, sortOrder } = this.lastLazyLoadEvent;
    const page = first! / rows!;
    const direction = sortOrder === -1 ? 'DESC' : 'ASC';

    let productId: number | undefined = undefined;
    if (this.selectedProduct) {
      if (typeof this.selectedProduct === 'object') {
        productId = this.selectedProduct.productId || this.selectedProduct.value?.productId || this.selectedProduct.value;
      } else if (typeof this.selectedProduct === 'number') {
        productId = this.selectedProduct;
      }
    }

    let warehouseId: number | undefined = undefined;
    if (this.selectedWarehouse) {
      if (typeof this.selectedWarehouse === 'object') {
        warehouseId = this.selectedWarehouse.warehouseId || this.selectedWarehouse.value?.warehouseId || this.selectedWarehouse.value;
      } else if (typeof this.selectedWarehouse === 'number') {
        warehouseId = this.selectedWarehouse;
      }
    }

    let startDateStr: string | undefined = undefined;
    let endDateStr: string | undefined = undefined;
    
    if (this.startDate) {
      startDateStr = this.formatDateForApi(this.startDate, true);
    }
    
    if (this.endDate) {
      endDateStr = this.formatDateForApi(this.endDate, false);
    }

    setTimeout(async () => {
      this.isLoading = true;
      
      (await this.writeOffService.searchWriteOffs(
        page,
        rows!,
        productId,
        warehouseId,
        this.selectedCondition || undefined,
        this.selectedSourceType || undefined,
        this.selectedStatus || undefined,
        startDateStr,
        endDateStr,
        sortField || 'writeOffDate',
        direction
      )).subscribe({
        next: (response: any) => {
          this.writeOffs = (response.content || []).map((wo: any) => ({
            ...wo,
            // Handle flat format from backend (productId, warehouseId, productName, warehouseName)
            product: wo.product || (wo.productId ? {
              productId: wo.productId,
              name: wo.productName,
              reference: wo.productReference
            } : null),
            warehouse: wo.warehouse || (wo.warehouseId ? {
              warehouseId: wo.warehouseId,
              name: wo.warehouseName
            } : null),
            writeOffDate: wo.writeOffDate ? new Date(wo.writeOffDate) : null,
            approvedDate: wo.approvedDate ? new Date(wo.approvedDate) : null,
            rejectedDate: wo.rejectedDate ? new Date(wo.rejectedDate) : null,
            creationDate: wo.creationDate ? new Date(wo.creationDate) : null
          }));
          this.totalRecords = response.totalElements || 0;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('Error loading write-offs:', err);
          this.isLoading = false;
          this.cdr.markForCheck();
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_write_offs'),
            life: 3000
          });
        }
      });
    }, 0);
  }

  formatDateForApi(date: Date, isStart: boolean): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = isStart ? '00' : '23';
    const minutes = isStart ? '00' : '59';
    const seconds = isStart ? '00' : '59';
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  applyFilters() {
    this.lastLazyLoadEvent = {
      first: 0,
      rows: this.pageSize,
      sortField: 'writeOffDate',
      sortOrder: -1
    };
    this.loadWriteOffs();
  }

  resetFilters() {
    this.selectedProduct = null;
    this.selectedWarehouse = null;
    this.selectedCondition = null;
    this.selectedSourceType = null;
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
    this.applyFilters();
  }

  // Status helpers
  getStatusSeverity(status: string | undefined): string {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s === 'PENDING') return 'warning';
    if (s === 'APPROVED') return 'success';
    if (s === 'REJECTED') return 'danger';
    return '';
  }

  getConditionSeverity(condition: string | undefined): string {
    if (!condition) return '';
    const c = condition.toUpperCase();
    if (c === 'DAMAGED' || c === 'UNUSABLE') return 'danger';
    if (c === 'LOST') return 'warn';
    if (c === 'EXPIRED') return 'info';
    return '';
  }

  getConditionLabel(condition: string | undefined): string {
    if (!condition) return 'N/A';
    const key = `item_condition_${condition.toLowerCase()}`;
    return this.translate.instant(key) || condition;
  }

  getSourceTypeLabel(sourceType: string | undefined): string {
    if (!sourceType) return 'N/A';
    const key = `write_off_source_type_${sourceType.toLowerCase().replace(/_/g, '_')}`;
    return this.translate.instant(key) || sourceType;
  }

  getStatusLabel(status: string | undefined): string {
    if (!status) return 'N/A';
    const key = `write_off_status_${status.toLowerCase()}`;
    return this.translate.instant(key) || status;
  }

  getProductId(writeOff: InventoryWriteOff): number | undefined {
    return writeOff.product?.productId || (writeOff as any).productId;
  }

  getProductName(writeOff: InventoryWriteOff): string | undefined {
    return writeOff.product?.name || (writeOff as any).productName;
  }

  getWarehouseId(writeOff: InventoryWriteOff): number | undefined {
    return writeOff.warehouse?.warehouseId || (writeOff as any).warehouseId;
  }

  getWarehouseName(writeOff: InventoryWriteOff): string | undefined {
    return writeOff.warehouse?.name || (writeOff as any).warehouseName;
  }

  viewProductDetails(writeOff: InventoryWriteOff, event: Event) {
    const productId = this.getProductId(writeOff);
    if (!productId) return;
    event.stopPropagation();
    this.router.navigate(['/inventory/products', productId]);
  }

  viewWarehouseDetails(writeOff: InventoryWriteOff, event: Event) {
    const warehouseId = this.getWarehouseId(writeOff);
    if (!warehouseId) return;
    event.stopPropagation();
    this.router.navigate(['/inventory/warehouses', warehouseId]);
  }

  canApprove(writeOff: InventoryWriteOff): boolean {
    return writeOff.status === 'PENDING' && this.canApproveWriteOff;
  }

  canReject(writeOff: InventoryWriteOff): boolean {
    return writeOff.status === 'PENDING' && this.canApproveWriteOff;
  }

  // Detail View Methods
  viewWriteOffDetails(writeOff: InventoryWriteOff) {
    if (!writeOff.writeOffId) return;
    this.router.navigate(['/inventory/write-offs', writeOff.writeOffId]);
  }

  // Action Methods
  openApproveConfirm(writeOff: InventoryWriteOff) {
    this.selectedWriteOff = writeOff;
    this.approveConfirmDialog = true;
  }

  async confirmApprove() {
    if (!this.selectedWriteOff?.writeOffId) return;

    this.isLoading = true;
    (await this.writeOffService.approveWriteOff(this.selectedWriteOff.writeOffId)).subscribe({
      next: (response: InventoryWriteOff) => {
        this.isLoading = false;
        this.approveConfirmDialog = false;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('write_off_approved_successfully'),
          life: 3000
        });
        this.loadWriteOffs();
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Error approving write-off:', err);
        let errorMessage = this.translate.instant('error_approving_write_off');
        
        if (err.error?.message) {
          errorMessage = err.error.message;
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

  openRejectConfirm(writeOff: InventoryWriteOff) {
    this.selectedWriteOff = writeOff;
    this.rejectionReason = '';
    this.rejectConfirmDialog = true;
  }

  async confirmReject() {
    if (!this.selectedWriteOff?.writeOffId) return;

    this.isLoading = true;
    (await this.writeOffService.rejectWriteOff(this.selectedWriteOff.writeOffId, this.rejectionReason)).subscribe({
      next: (response: InventoryWriteOff) => {
        this.isLoading = false;
        this.rejectConfirmDialog = false;
        this.rejectionReason = '';
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('write_off_rejected_successfully'),
          life: 3000
        });
        this.loadWriteOffs();
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Error rejecting write-off:', err);
        let errorMessage = this.translate.instant('error_rejecting_write_off');
        
        if (err.error?.message) {
          errorMessage = err.error.message;
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

  navigateToCreate() {
    this.router.navigate(['/inventory/write-offs/create']);
  }

  getReasonLabel(reason: string | undefined): string {
    if (!reason) return '-';
    // Check if reason is a predefined value (uppercase) that needs translation
    const upperReason = reason.toUpperCase().trim();
    const translationKey = `write_off_reason_${upperReason.toLowerCase()}`;
    const translated = this.translate.instant(translationKey);
    
    // If translation exists and is different from the key, use it
    if (translated && translated !== translationKey) {
      return translated;
    }
    
    // If it's a predefined reason value, try common reason translations
    if (upperReason === 'DEFECTIVE') {
      return this.translate.instant('return_reason_defective') || reason;
    }
    if (upperReason === 'INCORRECT_ITEM') {
      return this.translate.instant('return_reason_incorrect_item') || reason;
    }
    if (upperReason === 'CHANGE_OF_MIND') {
      return this.translate.instant('return_reason_change_of_mind') || reason;
    }
    if (upperReason === 'OTHER') {
      return this.translate.instant('return_reason_other') || reason;
    }
    
    // For custom reasons, return as-is
    return reason;
  }
}

