import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { LazyLoadEvent, MenuItem, SelectItem } from 'primeng/api';
import { Table } from 'primeng/table';
import { Category } from 'src/app/models/category';
import { Customer } from 'src/app/models/customer';
import { Order } from 'src/app/models/order';
import { Payment } from 'src/app/models/payment';
import { Product } from 'src/app/models/product';
import { Shop } from 'src/app/models/shop';
import { Supplier } from 'src/app/models/supplier';
import { Warehouse } from 'src/app/models/warehouse';
import { TranslationService } from 'src/app/services/translation.service';
import { getPaymentMethodLabel } from 'src/app/shared/payment-utils';
import { getExpirationStatus, getExpirationInfo, getExpirationSeverity, getExpirationIcon, ExpirationStatus } from 'src/app/shared/product-expiration.utils';
import { displayWarehouseStockQuantity, formatProductStockLabel, getAvailableQuantity, hasWriteOffs, getWriteOffQuantity } from 'src/app/shared/product-utils';
import { QuantityScale } from 'src/app/utils/quantity-scale.util';
import { getPreferredProductImageUrl } from 'src/app/shared/product-image.utils';

interface LazyLoadEventExt extends LazyLoadEvent {
  globalFilter?: string;
  filters?: { [field: string]: any };
}

@Component({
  selector: 'app-products-table',
  templateUrl: './products-table.component.html',
  styleUrls: ['./products-table.component.css', '../products.component.css', '../../inventory.component.css']
})
export class ProductsTableComponent {
  @ViewChild('dt') dt!: Table;

  @Input() products: Product[] = [];
  @Input() cols: any[] = [];
  @Input() pageSize = 20;
  @Input() rowsPerPageOptions: number[] = [10, 20, 50, 100];
  @Input() totalRecords = 0;
  @Input() totalAmount = 0;
  @Input() totalPaid = 0
  @Input() remainingBalance = 0;
  @Input() isLoading = false;
  @Input() isAdmin = false;
  @Input() isWarehouseman = false;
  @Input() isVendor = false;
  @Input() canEditProduct = false;
  @Input() canDeleteProduct = false;
  @Input() canAddProduct = false;
  @Input() canReadProduct = false;
  @Input() canArchiveProduct = false;
  @Input() currency: string = 'USD';
  @Input() selectedProducts: Product[] = [];
  @Input() categories: Category[] = [];
  @Input() warehouses: Warehouse[] = [];
  @Input() suppliers: Supplier[] = [];
  @Input() statuses: string[] = [];
  @Input() filteredProducts: Product[] = [];
  @Input() printOptions: any[] = [];
  @Input() getProfitClass: (product: Product) => string = () => '';
  @Input() calculateProfit: (product: Product) => number = () => 0;
  @Input() getQuantitySeverity: (quantity: number) => string = () => 'info';
  @Input() getMeasureUnit: (measureUnit: string, quantity: number) => string = () => 'UNIT';
  @Input() getAvailableQuantity: (product: Product) => number = (product) => getAvailableQuantity(product);
  @Input() hasWriteOffs: (product: Product) => boolean = (product) => hasWriteOffs(product);
  @Input() getWriteOffQuantity: (product: Product) => number = (product) => getWriteOffQuantity(product);
  /** When true, sales exclude approved write-offs; main stock column is sellable (net) quantity. */
  @Input() strictSellableStockExcludesWriteoffs = false;
  @Input() expandedProducts: { [key: number]: boolean } = {};
  @Input() isProductRowExpanded: (productId: number) => boolean = () => false;
  @Input() toggleProductRow: (productId: number) => void = () => {};
  @Input() getAggregatedWarehouseStocks: (product: any) => any[] = () => [];
  @Input() viewMode: 'standard' | 'aggregated' = 'standard';
  @Input() tableViewMode: 'list' | 'grid' = 'list';
  @Input() isExporting: boolean = false;
  @Input() productStats: { totalProducts: number; inStockCount: number; lowStockCount: number; outOfStockCount: number; stockValueAtCost: number; stockValueAtRetail: number; expiringSoonCount: number; inactiveCount: number; averageMarginPercent: number; } | null = null;

  @Output() onTableViewModeChange = new EventEmitter<{ value: 'list' | 'grid' }>();
  @Output() editProductEvent = new EventEmitter<Product>();
  @Output() deleteProductEvent = new EventEmitter<Product>();
  @Output() addProductEvent = new EventEmitter<Product>();
  @Output() confirmProductEvent = new EventEmitter<Product>();
  @Output() archivedProductsEvent = new EventEmitter<Product>();
  @Output() archiveProductEvent = new EventEmitter<Product>();
  @Output() lazyLoadEvent = new EventEmitter<LazyLoadEventExt>();
  @Output() onGlobalFilter = new EventEmitter<{ globalFilter: string }>();
  @Output() deleteSelectedProductsEvent = new EventEmitter<LazyLoadEvent>();
  @Output() selectedProductsChange = new EventEmitter<Product[]>();
  @Output() showProductDetailsEvent = new EventEmitter<Product>();
  @Output() showWarehouseDetailsEvent = new EventEmitter<number>();
  @Output() exportPdfEvent = new EventEmitter<void>();
  @Output() exportExcelEvent = new EventEmitter<void>();
  @Output() applyFiltersEvent = new EventEmitter<{
    categoryIds?: number[];
    warehouseIds?: number[];
    supplierIds?: number[];
    inventoryStatus?: string;
    productType?: string;
    expirationStatus?: string;
    globalFilter?: string;
  }>();
  @Output() deactivateScanningEvent = new EventEmitter<void>();
  @Output() activateScanningEvent = new EventEmitter<void>();
  @Output() importProductsEvent = new EventEmitter<void>();

  items: MenuItem[] | undefined;
  sortOptions: SelectItem[] = [];

  // Filter properties
  globalFilter: string = '';
  categoryFilters: Category[] = [];
  showAdvancedFilters = false;
  warehouseFilters: Warehouse[] = [];
  supplierFilters: Supplier[] = [];
  inventoryStatusFilter: string | undefined = undefined;
  productTypeFilter: string | undefined = undefined;
  expirationStatusFilter: string | undefined = undefined;

  // View options
  currentView: 'list' | 'grid' = 'list';
  viewOptions = [
    { icon: 'pi pi-list', value: 'list' },
    { icon: 'pi pi-th-large', value: 'grid' }
  ];

  inventoryStatusOptions: SelectItem[] = [];
  productTypeOptions: SelectItem[] = [];
  expirationStatusOptions: SelectItem[] = [];

  constructor(
    private translate: TranslateService,
    private router: Router,
  ) {
    this.sortOptions = [
      { label: this.translate.instant('descending_price'), value: '!sellingPrice' },
      { label: this.translate.instant('ascending_price'), value: 'sellingPrice' },
      { label: this.translate.instant('availability_desc'), value: 'inventoryStatus' },
      { label: this.translate.instant('availability_asc'), value: '!inventoryStatus' }
    ];

    this.inventoryStatusOptions = [
      { label: this.translate.instant('all'), value: undefined },
      { label: this.translate.instant('product_instock'), value: 'INSTOCK' },
      { label: this.translate.instant('product_lowstock'), value: 'LOWSTOCK' },
      { label: this.translate.instant('product_outofstock'), value: 'OUTOFSTOCK' }
    ];

    this.productTypeOptions = [
      { label: this.translate.instant('product_type_product'), value: 'PRODUCT' },
      { label: this.translate.instant('product_type_service'), value: 'SERVICE' }
    ];

    this.expirationStatusOptions = [
      { label: this.translate.instant('with_expiration'), value: 'with_expiration' },
      { label: this.translate.instant('without_expiration'), value: 'without_expiration' },
      { label: this.translate.instant('expired'), value: 'expired' },
      { label: this.translate.instant('expiring_soon'), value: 'expiring_soon' },
      { label: this.translate.instant('valid'), value: 'valid' }
    ];
  }

  isService(product: Product): boolean {
    if (!product) return false;
    return product.productType === 'SERVICE';
  }

  isProduct(product: Product): boolean {
    if (!product) return false;
    return !product.productType || product.productType === 'PRODUCT';
  }

  canEditRow(product: Product): boolean {
    return this.canEditProduct && !(this.viewMode === 'aggregated' && (product as any)?._aggregated);
  }

  onSelectionChange(event: Payment[]) {
    this.selectedProductsChange.emit(event);
  }

  onLazyLoad(event: LazyLoadEvent) {
    const payload = { ...event } as LazyLoadEventExt;
    if (this.viewMode === 'aggregated') {
      const sf = payload.sortField as string | undefined;
      if (!sf || sf === 'creationDate') {
        payload.sortField = 'name';
      }
    }
    this.lazyLoadEvent.emit(payload as any);
  }

  onGlobalFilterChange(event: Event) {
    this.deactivateScanningEvent.emit();
    const value = (event.target as HTMLInputElement).value.trim();
    this.onGlobalFilter.emit({ globalFilter: value });
    
    // Also filter the table directly if we have the reference
    if (this.dt) {
      this.dt.filterGlobal(value, 'contains');
    }
  }

  onFilterChange() {
    this.applyFiltersEvent.emit({
      categoryIds: this.categoryFilters?.map(c => c.categoryId).filter(id => id !== undefined) as number[],
      warehouseIds: this.isAdmin
        ? this.warehouseFilters?.map(w => w.warehouseId).filter(id => id !== undefined) as number[]
        : [],
      supplierIds: this.supplierFilters?.map(s => s.supplierId).filter(id => id !== undefined) as number[],
      inventoryStatus: this.inventoryStatusFilter,
      productType: this.productTypeFilter,
      expirationStatus: this.expirationStatusFilter,
      globalFilter: this.globalFilter
    });
  }

  clearFilters() {
    this.globalFilter = '';
    this.categoryFilters = [];
    this.warehouseFilters = [];
    this.supplierFilters = [];
    this.inventoryStatusFilter = undefined;
    this.productTypeFilter = undefined;
    this.expirationStatusFilter = undefined;
    
    if (this.dt) {
      this.dt.clear();
    }
    
    this.applyFiltersEvent.emit({});
  }

  onViewChange() {
    // View changed, no additional action needed
  }

  onGridPageChange(event: any) {
    this.lazyLoadEvent.emit({
      first: event.first,
      rows: event.rows
    });
  }

  buildMenuItems(product: any) {
    this.items = [
      {
        label: this.translate.instant('edit_button'),
        icon: 'pi pi-fw pi-pencil',
        command: () => this.editProductEvent.emit(product),
      },
    ];

    if (this.canDeleteProduct) {
      this.items.push({
        label: this.translate.instant('delete_button'),
        icon: 'pi pi-fw pi-trash',
        command: () => this.deleteProductEvent.emit(product),
      });
    }

    if (this.canArchiveProduct) {
      this.items.push({
        label: this.translate.instant('archive_button'),
        icon: 'pi pi-fw pi-folder',
        command: () => this.archiveProductEvent.emit(product),
      });
    }
  }

  // Expiration status helper methods
  getExpirationStatus(product: Product): ExpirationStatus | null {
    if (!this.isProduct(product) || !product.expirationDate) {
      return null; // No expiration date or not a product
    }
    return getExpirationStatus(product, 7);
  }

  getExpirationInfo(product: Product) {
    if (!this.isProduct(product) || !product.expirationDate) {
      return null;
    }
    return getExpirationInfo(product, 7);
  }

  getExpirationSeverity(status: ExpirationStatus | null): string {
    if (!status) return 'info';
    return getExpirationSeverity(status);
  }

  getExpirationIcon(status: ExpirationStatus | null): string {
    if (!status) return 'pi pi-info-circle';
    return getExpirationIcon(status);
  }

  getExpirationDays(product: Product): number {
    const info = this.getExpirationInfo(product);
    return info ? info.daysUntilExpiration : 0;
  }

  shouldShowExpirationBadge(product: Product): boolean {
    if (!this.isProduct(product) || !product.expirationDate) {
      return false; // No badge for services or products without expiration date
    }
    const status = this.getExpirationStatus(product);
    // Show badge for expired and expiring soon, hide for valid products
    return status === 'EXPIRED' || status === 'EXPIRING_SOON';
  }

  showValidIndicator(product: Product): boolean {
    if (!this.isProduct(product) || !product.expirationDate) {
      return false;
    }
    const status = this.getExpirationStatus(product);
    return status === 'VALID';
  }

  viewWarehouseDetails(warehouseId: number): void {
    this.showWarehouseDetailsEvent.emit(warehouseId);
  }

  /** Open single-SKU product details with stock adjustment dialog (from aggregated list expansion). */
  navigateToSkuAdjustStock(productId: number): void {
    if (!productId) return;
    void this.router.navigate(['/inventory/products', productId], {
      queryParams: { openAdjustStock: 'true' },
    });
  }

  getProductImage(product: Product | null | undefined): string {
    return getPreferredProductImageUrl(product);
  }

  formatStockLabel(product: Product): { quantity: string; unit: string } {
    return formatProductStockLabel(product);
  }

  warehouseDisplayQuantity(product: Product, storageQuantity: number | null | undefined): number {
    return displayWarehouseStockQuantity(product, storageQuantity);
  }

  formatWarehouseStock(product: Product, storageQuantity: number | null | undefined): string {
    const displayQty = displayWarehouseStockQuantity(product, storageQuantity);
    const precision = QuantityScale.isFractional(product) ? QuantityScale.effectivePrecision(product) : 0;
    return precision > 0 ? displayQty.toFixed(precision) : String(Math.round(displayQty));
  }
}
