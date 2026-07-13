import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef } from '@angular/core';
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
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import {
  initTablePageSizeState,
  persistTablePageSizeFromLazyEvent,
  TablePageSizeKeys,
} from 'src/app/utils/table-page-size.storage';
import {
  displayWarehouseStockQuantity,
  formatLineQuantity,
  getLineMeasureUnit,
} from 'src/app/shared/product-utils';

@Component({
  templateUrl: './stock-movements.component.html',
  styleUrls: ['./stock-movements.component.css', '../inventory.component.css'],
  providers: [MessageService, DatePipe]
})
export class StockMovementsComponent implements OnInit, OnDestroy {
  @ViewChild('dt') table!: Table;

  // List view
  movements: StockMovement[] = [];
  isLoading: boolean = true;
  isExporting: boolean = false;
  exportProgress: string = '';
  totalRecords: number = 0;
  lastLazyLoadEvent?: LazyLoadEvent;
  isInitialLoad: boolean = true;
  private lazyLoadCallCount = 0;
  
  // Filters
  selectedProduct: any = null;
  selectedWarehouse: any = null;
  selectedMovementType: string | null = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  globalSearchText: string = '';
  pageSize: number = 20;
  pageSizeOptions = [20, 50, 100];
  private searchTimeout: any;
  
  // Dropdowns
  productSuggestions: any[] = [];
  warehouses: any[] = [];
  movementTypeOptions: any[] = [];
  
  // Permissions
  canReadMovement: boolean = false;
  
  resource: string = 'STOCK_MOVEMENTS';
  
  exportColumns!: ExportColumn[];

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
    private cdr: ChangeDetectorRef,
    private reportingService: ReportingService,
    private organizationService: OrganizationService,
    private datePipe: DatePipe
  ) {}

  async ngOnInit() {
    initTablePageSizeState(TablePageSizeKeys.stockMovements, this.pageSizeOptions, {
      pageSize: this.pageSize,
      lastLazyLoadEvent: this.lastLazyLoadEvent,
    });
    await this.setPermissions();
    await this.initializeTranslations();
    await this.loadInitialData();
    
    // Initialize export columns
    this.exportColumns = [
      { title: this.translateService.instant('date'), dataKey: 'movementDate' },
      { title: this.translateService.instant('product'), dataKey: 'productName' },
      { title: this.translateService.instant('warehouse'), dataKey: 'warehouseName' },
      { title: this.translateService.instant('movement_type'), dataKey: 'movementType' },
      { title: this.translateService.instant('quantity'), dataKey: 'quantity' },
      { title: this.translateService.instant('previous_quantity'), dataKey: 'previousQuantity' },
      { title: this.translateService.instant('new_quantity'), dataKey: 'newQuantity' },
      { title: this.translateService.instant('reference'), dataKey: 'reference' },
      { title: this.translateService.instant('performed_by'), dataKey: 'performedBy' }
    ];
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
      // Backend enum values: INBOUND, OUTBOUND, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT
      this.movementTypeOptions = [
        { label: translations['stock_movement_type_inbound'] || translations['stock_movement_type_purchase'] || 'Inbound', value: 'INBOUND' },
        { label: translations['stock_movement_type_outbound'] || translations['stock_movement_type_sale'] || 'Outbound', value: 'OUTBOUND' },
        { label: translations['stock_movement_type_transfer_in'] || 'Transfer In', value: 'TRANSFER_IN' },
        { label: translations['stock_movement_type_transfer_out'] || 'Transfer Out', value: 'TRANSFER_OUT' },
        { label: translations['stock_movement_type_adjustment'] || 'Adjustment', value: 'ADJUSTMENT' }
      ];
    });
  }

  async loadInitialData() {
    await this.loadWarehouses();
    this.lastLazyLoadEvent = {
      first: 0,
      rows: this.pageSize,
      sortField: 'movementDate',
      sortOrder: -1,
    };
    this.loadMovements();
  }

  async loadWarehouses() {
    try {
      await this.warehouseService.loadToken();
      this.warehouseService.getWarehouses().subscribe({
        next: (response: any) => {
          const warehousesList: any[] = Array.isArray(response) ? response : (response?.content ?? response?.page?.content ?? []);
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

  async searchProducts(event: { query: string }) {
    try {
      const token = await this.keycloakService.getToken();
      this.productService.jwt = token;
      this.productService.searchProductsForFilter(event.query).subscribe({
        next: (response: any) => {
          const list: any[] = Array.isArray(response) ? response : (response?.page?.content ?? response?.content ?? []);
          this.productSuggestions = list.map((p: Product) => ({
            label: `${p.reference || ''} - ${p.name || ''}`,
            value: p.productId,
            product: p
          }));
        },
        error: () => { this.productSuggestions = []; }
      });
    } catch {
      this.productSuggestions = [];
    }
  }

  onLazyLoad(event: LazyLoadEvent) {
    if (this.isLoading) {
      return;
    }
    this.lazyLoadCallCount++;
    if (this.lazyLoadCallCount === 1 && this.movements.length > 0) {
      this.isInitialLoad = false;
      return;
    }
    persistTablePageSizeFromLazyEvent(TablePageSizeKeys.stockMovements, this.pageSizeOptions, event, {
      pageSize: this.pageSize,
    });
    this.lastLazyLoadEvent = {
      ...event,
      rows: event.rows ?? this.lastLazyLoadEvent?.rows ?? this.pageSize,
    };
    this.isInitialLoad = false;
    this.isLoading = true;
    this.cdr.markForCheck();
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
    // Dropdowns use optionLabel="label" without optionValue, so selectedProduct/selectedWarehouse is the full object {label, value, product/warehouse}
    let productId: number | undefined = undefined;
    if (this.selectedProduct) {
      if (typeof this.selectedProduct === 'object') {
        // Check for .value first (from dropdown structure)
        productId = (this.selectedProduct as any).value || 
                   this.selectedProduct.productId || 
                   (this.selectedProduct as any).product?.productId;
      } else if (typeof this.selectedProduct === 'number') {
        productId = this.selectedProduct;
      }
    }
    
    let warehouseId: number | undefined = undefined;
    if (this.selectedWarehouse) {
      if (typeof this.selectedWarehouse === 'object') {
        // Check for .value first (from dropdown structure)
        warehouseId = (this.selectedWarehouse as any).value || 
                     this.selectedWarehouse.warehouseId || 
                     (this.selectedWarehouse as any).warehouse?.warehouseId;
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

    // Get movement type filter - ensure it's a valid string or undefined
    // const movementType: string | undefined = (this.selectedMovementType && this.selectedMovementType.trim() !== '') 
    //   ? this.selectedMovementType 
    //   : undefined;
    
    // Get search term from global search
    const searchTerm: string | undefined = (this.globalSearchText && this.globalSearchText.trim() !== '') 
      ? this.globalSearchText.trim() 
      : undefined;
    
    // Debug logging
    console.log('Loading movements with filters:', {
      productId,
      warehouseId,
      // movementType,
      startStr,
      endStr,
      searchTerm,
      page,
      rows: rows!
    });

    // Defer the entire loading operation to avoid change detection error
    setTimeout(async () => {
      this.isLoading = true;
      
      (await this.movementService.getStockMovements(
        page,
        rows!,
        productId,
        warehouseId,
        undefined,
        startStr,
        endStr,
        searchTerm
      )).subscribe({
        next: (response: any) => {
          // Map backend DTO fields to model fields
          this.movements = (response.content || []).map((dto: any) => ({
            movementId: dto.id,
            product: dto.productId ? {
              productId: dto.productId,
              reference: dto.productReference,
              name: dto.productName,
              stockTrackingMode: dto.stockTrackingMode,
              measureUnit: dto.measureUnit,
              quantityPrecision: dto.quantityPrecision
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
          this.isInitialLoad = false;
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('Error loading movements:', err);
          this.isLoading = false;
          this.isInitialLoad = false;
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
    this.isLoading = true;
    this.loadMovements();
  }

  resetFilters() {
    this.selectedProduct = null;
    this.selectedWarehouse = null;
    this.selectedMovementType = null;
    this.startDate = null;
    this.endDate = null;
    this.globalSearchText = '';
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

  /** Source types that map to a document detail page we can navigate to. */
  private readonly navigableSourceTypes = new Set<string>([
    'ORDER',
    'PURCHASE', 'PURCHASE_RECEIVED', 'PURCHASE_ADJUSTMENT',
    'ORDER_RETURN', 'ORDER_RETURN_CANCEL',
    'PURCHASE_RETURN', 'PURCHASE_RETURN_CANCEL',
  ]);

  /** True when the movement's source document has a detail page we can open. */
  isNavigableSource(movement: StockMovement): boolean {
    return !!(movement.sourceDocumentType && movement.sourceDocumentId
      && this.navigableSourceTypes.has(movement.sourceDocumentType.toUpperCase()));
  }

  // Navigation to source documents (uses the movement's sourceDocumentId → document detail page)
  navigateToSourceDocument(movement: StockMovement) {
    if (!this.isNavigableSource(movement)) {
      return;
    }
    const id = movement.sourceDocumentId;
    const type = (movement.sourceDocumentType || '').toUpperCase();

    if (type === 'ORDER') {
      this.router.navigate(['/sales/orders', id]);
    } else if (type === 'ORDER_RETURN' || type === 'ORDER_RETURN_CANCEL') {
      this.router.navigate(['/sales/returns', id]);
    } else if (type === 'PURCHASE_RETURN' || type === 'PURCHASE_RETURN_CANCEL') {
      this.router.navigate(['/purchases/purchase-returns', id]);
    } else if (type.startsWith('PURCHASE')) {
      // PURCHASE, PURCHASE_RECEIVED, PURCHASE_ADJUSTMENT
      this.router.navigate(['/purchases/purchases', id]);
    }
  }

  // Status helpers - Updated to match backend enum: INBOUND, OUTBOUND, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT
  getMovementTypeSeverity(type: string | undefined): string {
    if (!type) return '';
    const t = type.toUpperCase();
    if (t === 'INBOUND' || t === 'TRANSFER_IN') return 'success';
    if (t === 'OUTBOUND' || t === 'TRANSFER_OUT') return 'info';
    if (t === 'ADJUSTMENT') return 'warning';
    return '';
  }

  getMovementTypeIcon(type: string | undefined): string {
    if (!type) return '';
    const t = type.toUpperCase();
    if (t === 'INBOUND') return 'pi pi-arrow-down';
    if (t === 'OUTBOUND') return 'pi pi-arrow-up';
    if (t === 'TRANSFER_IN') return 'pi pi-arrow-down';
    if (t === 'TRANSFER_OUT') return 'pi pi-arrow-up';
    if (t === 'ADJUSTMENT') return 'pi pi-refresh';
    return 'pi pi-circle';
  }

  /** Storage quantity → display quantity using the movement product's tracking mode (e.g. 500 → 0.5 kg). */
  private toMovementDisplayQuantity(movement: StockMovement, storageQuantity: number | null | undefined): number {
    return displayWarehouseStockQuantity(movement?.product as Product, storageQuantity ?? 0);
  }

  getQuantityDisplay(movement: StockMovement): string {
    const rawQuantity = movement.quantity || 0;
    // quantityChange is a magnitude for in/out moves; sign is derived from the movement type.
    const displayMagnitude = this.toMovementDisplayQuantity(movement, Math.abs(rawQuantity));
    const formatted = formatLineQuantity(movement?.product as Product, displayMagnitude);
    const type = movement.movementType?.toUpperCase();
    // Backend enum: INBOUND, OUTBOUND, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT
    if (type === 'INBOUND' || type === 'TRANSFER_IN') {
      return `+${formatted}`;
    }
    if (type === 'OUTBOUND' || type === 'TRANSFER_OUT') {
      return `-${formatted}`;
    }
    // For ADJUSTMENT, show sign based on the raw quantity value
    return rawQuantity < 0 ? `-${formatted}` : `+${formatted}`;
  }

  /** Display-unit value for the previous/new stock-level columns (unsigned). */
  formatStockLevel(movement: StockMovement, storageQuantity: number | null | undefined): string {
    if (storageQuantity == null) {
      return 'N/A';
    }
    return formatLineQuantity(movement?.product as Product, this.toMovementDisplayQuantity(movement, storageQuantity));
  }

  /** Translatable unit key for a movement's quantity columns ('' when no unit should be shown). */
  getMovementQuantityUnit(movement: StockMovement): string {
    const displayQty = this.toMovementDisplayQuantity(movement, Math.abs(movement.quantity || 0));
    return getLineMeasureUnit(movement?.product as Product, displayQty);
  }

  hasSourceDocument(movement: StockMovement): boolean {
    return !!(movement.sourceDocumentType && movement.sourceDocumentId);
  }

  /**
   * Human-readable, translated label for a movement's source document type
   * (e.g. ORDER → "Order"/"Commande", PURCHASE → "Purchase"/"Achat").
   * Falls back to the raw value when no translation key exists.
   */
  getSourceDocumentLabel(type: string | undefined | null): string {
    if (!type) {
      return '';
    }
    const key = 'stock_movement_source_' + type.toLowerCase();
    const translated = this.translate.instant(key);
    return translated && translated !== key ? translated : type;
  }

  ngOnDestroy() {
    // Clear search timeout on component destroy
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.globalSearchText = value;
    
    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Debounce search - wait 500ms after user stops typing
    this.searchTimeout = setTimeout(() => {
      this.applyFilters();
    }, 500);
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
      
      // Fetch all filtered stock movements from backend using current filter parameters
      // Extract filter values
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
      
      // Format dates
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
      
      // Get movement type filter
      const movementType: string | undefined = (this.selectedMovementType && this.selectedMovementType.trim() !== '') 
        ? this.selectedMovementType 
        : undefined;
      
      // Get search term from global search
      const searchTerm: string | undefined = (this.globalSearchText && this.globalSearchText.trim() !== '') 
        ? this.globalSearchText.trim() 
        : undefined;
      
      // Fetch all movements with current filters - use pagination to get all records
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredMovements: any[] = [];
      let currentPage = 0;
      const pageSize = 1000; // Fetch in chunks of 1000
      let hasMore = true;
      let totalElements = 0;
      
      while (hasMore) {
        const pageResponse: any = await firstValueFrom(
          await this.movementService.getStockMovements(
            currentPage,
            pageSize,
            productId,
            warehouseId,
            movementType,
            startStr,
            endStr,
            searchTerm
          )
        );
        
        const pageContent = pageResponse?.content || [];
        allFilteredMovements = allFilteredMovements.concat(pageContent);
        totalElements = pageResponse?.totalElements || 0;
        
        // Update progress
        const progressPercent = totalElements > 0 
          ? Math.min(100, Math.round((allFilteredMovements.length / totalElements) * 100))
          : 0;
        this.exportProgress = `${this.translate.instant('fetching_data') || 'Fetching data'}... ${allFilteredMovements.length} / ${totalElements} (${progressPercent}%)`;
        this.cdr.detectChanges(); // Update UI with progress
        
        // Check if there are more pages
        const totalPages = pageResponse?.totalPages || 0;
        hasMore = currentPage + 1 < totalPages && allFilteredMovements.length < totalElements;
        currentPage++;
        
        // Safety limit to prevent infinite loops
        if (currentPage > 100) {
          console.warn('Export stopped at 100 pages to prevent excessive data fetching');
          break;
        }
      }
      
      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';
      this.cdr.detectChanges();
      
      // Extract movements from response and map to model format
      const filteredMovements = allFilteredMovements.map((dto: any) => ({
        movementId: dto.id,
        product: dto.productId ? {
          productId: dto.productId,
          reference: dto.productReference,
          name: dto.productName,
          stockTrackingMode: dto.stockTrackingMode,
          measureUnit: dto.measureUnit,
          quantityPrecision: dto.quantityPrecision
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
      
      // Prepare movements for export with calculated fields
      const exportData = filteredMovements.map(movement => ({
        movementDate: movement.movementDate ? this.datePipe.transform(movement.movementDate, 'short') : 'N/A',
        productName: movement.product?.name || 'N/A',
        warehouseName: movement.warehouse?.name || 'N/A',
        movementType: movement.movementType ? this.translate.instant(`stock_movement_type_${movement.movementType.toLowerCase()}`) : 'N/A',
        quantity: this.getQuantityDisplay(movement),
        previousQuantity: this.formatStockLevel(movement, movement.previousQuantity),
        newQuantity: this.formatStockLevel(movement, movement.newQuantity),
        reference: movement.reference || 'N/A',
        sourceDocument: movement.sourceDocumentType ? (movement.reference ? `${this.getSourceDocumentLabel(movement.sourceDocumentType)}: ${movement.reference}` : this.getSourceDocumentLabel(movement.sourceDocumentType)) : 'N/A',
        performedBy: movement.performedBy || 'N/A'
      }));
      
      // Build translated export columns based on organization's default locale
      const translationKeyMap: { [key: string]: string } = {
        'movementDate': 'date',
        'productName': 'product',
        'warehouseName': 'warehouse',
        'movementType': 'movement_type',
        'quantity': 'quantity',
        'previousQuantity': 'previous_quantity',
        'newQuantity': 'new_quantity',
        'reference': 'reference',
        'performedBy': 'performed_by'
      };
      
      const translatedExportColumns: ExportColumn[] = this.exportColumns.map((col) => {
        const translationKey = translationKeyMap[col.dataKey] || col.dataKey;
        return {
          title: this.translate.instant(translationKey),
          dataKey: col.dataKey
        };
      });
      
      // Get translated title for PDF
      const pdfTitle = this.translate.instant('stock_movements_menu_title');
      
      // Export with translated headers and title
      this.reportingService.exportPdf(translatedExportColumns, exportData, 'stock-movements', pdfTitle);
      
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
      
      // Fetch all filtered stock movements from backend using current filter parameters
      // Extract filter values
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
      
      // Format dates
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
      
      // Get movement type filter
      const movementType: string | undefined = (this.selectedMovementType && this.selectedMovementType.trim() !== '') 
        ? this.selectedMovementType 
        : undefined;
      
      // Get search term from global search
      const searchTerm: string | undefined = (this.globalSearchText && this.globalSearchText.trim() !== '') 
        ? this.globalSearchText.trim() 
        : undefined;
      
      // Fetch all movements with current filters - use pagination to get all records
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredMovements: any[] = [];
      let currentPage = 0;
      const pageSize = 1000; // Fetch in chunks of 1000
      let hasMore = true;
      let totalElements = 0;
      
      while (hasMore) {
        const pageResponse: any = await firstValueFrom(
          await this.movementService.getStockMovements(
            currentPage,
            pageSize,
            productId,
            warehouseId,
            movementType,
            startStr,
            endStr,
            searchTerm
          )
        );
        
        const pageContent = pageResponse?.content || [];
        allFilteredMovements = allFilteredMovements.concat(pageContent);
        totalElements = pageResponse?.totalElements || 0;
        
        // Update progress
        const progressPercent = totalElements > 0 
          ? Math.min(100, Math.round((allFilteredMovements.length / totalElements) * 100))
          : 0;
        this.exportProgress = `${this.translate.instant('fetching_data') || 'Fetching data'}... ${allFilteredMovements.length} / ${totalElements} (${progressPercent}%)`;
        this.cdr.detectChanges(); // Update UI with progress
        
        // Check if there are more pages
        const totalPages = pageResponse?.totalPages || 0;
        hasMore = currentPage + 1 < totalPages && allFilteredMovements.length < totalElements;
        currentPage++;
        
        // Safety limit to prevent infinite loops
        if (currentPage > 100) {
          console.warn('Export stopped at 100 pages to prevent excessive data fetching');
          break;
        }
      }
      
      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';
      this.cdr.detectChanges();
      
      // Extract movements from response and map to model format
      const filteredMovements = allFilteredMovements.map((dto: any) => ({
        movementId: dto.id,
        product: dto.productId ? {
          productId: dto.productId,
          reference: dto.productReference,
          name: dto.productName,
          stockTrackingMode: dto.stockTrackingMode,
          measureUnit: dto.measureUnit,
          quantityPrecision: dto.quantityPrecision
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
      
      // Prepare movements for export with calculated fields and translated headers
      const exportData = filteredMovements.map(movement => {
        const translated: any = {};
        translated[this.translate.instant('date')] = movement.movementDate ? this.datePipe.transform(movement.movementDate, 'short') : 'N/A';
        translated[this.translate.instant('product')] = movement.product?.name || 'N/A';
        translated[this.translate.instant('warehouse')] = movement.warehouse?.name || 'N/A';
        translated[this.translate.instant('movement_type')] = movement.movementType ? this.translate.instant(`stock_movement_type_${movement.movementType.toLowerCase()}`) : 'N/A';
        translated[this.translate.instant('quantity')] = this.getQuantityDisplay(movement);
        translated[this.translate.instant('previous_quantity')] = this.formatStockLevel(movement, movement.previousQuantity);
        translated[this.translate.instant('new_quantity')] = this.formatStockLevel(movement, movement.newQuantity);
        translated[this.translate.instant('reference')] = movement.reference || 'N/A';
        translated[this.translate.instant('source_document')] = movement.sourceDocumentType ? (movement.reference ? `${this.getSourceDocumentLabel(movement.sourceDocumentType)}: ${movement.reference}` : this.getSourceDocumentLabel(movement.sourceDocumentType)) : 'N/A';
        translated[this.translate.instant('performed_by')] = movement.performedBy || 'N/A';
        return translated;
      });
      
      // Export the translated array to Excel
      this.reportingService.exportExcel(exportData, 'stock-movements');
      
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

