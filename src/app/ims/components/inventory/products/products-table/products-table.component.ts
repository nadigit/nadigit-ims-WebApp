import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
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
  @Input() totalRecords = 0;
  @Input() totalAmount = 0;
  @Input() totalPaid = 0
  @Input() remainingBalance = 0;
  @Input() isLoading = false;
  @Input() isAdmin = false;
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
  @Output() exportPdfEvent = new EventEmitter<void>();
  @Output() exportExcelEvent = new EventEmitter<void>();
  @Output() applyFiltersEvent = new EventEmitter<{
    categoryIds?: number[];
    warehouseIds?: number[];
    supplierIds?: number[];
    inventoryStatus?: string;
    globalFilter?: string;
  }>();
  @Output() deactivateScanningEvent = new EventEmitter<void>();
  @Output() activateScanningEvent = new EventEmitter<void>();

  items: MenuItem[] | undefined;
  sortOptions: SelectItem[] = [];
  rowsPerPageOptions = [10, 20, 50, 100];

  // Filter properties
  globalFilter: string = '';
  categoryFilters: Category[] = [];
  warehouseFilters: Warehouse[] = [];
  supplierFilters: Supplier[] = [];
  inventoryStatusFilter: string | undefined = undefined;

  // View options
  currentView: 'list' | 'grid' = 'list';
  viewOptions = [
    { icon: 'pi pi-list', value: 'list' },
    { icon: 'pi pi-th-large', value: 'grid' }
  ];

  inventoryStatusOptions: SelectItem[] = [];

  constructor(private translate: TranslateService) {
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
  }

  onSelectionChange(event: Payment[]) {
    this.selectedProductsChange.emit(event);
  }

  onLazyLoad(event: LazyLoadEvent) {
    this.lazyLoadEvent.emit({ ...event } as any);
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
      warehouseIds: this.warehouseFilters?.map(w => w.warehouseId).filter(id => id !== undefined) as number[],
      supplierIds: this.supplierFilters?.map(s => s.supplierId).filter(id => id !== undefined) as number[],
      inventoryStatus: this.inventoryStatusFilter,
      globalFilter: this.globalFilter
    });
  }

  clearFilters() {
    this.globalFilter = '';
    this.categoryFilters = [];
    this.warehouseFilters = [];
    this.supplierFilters = [];
    this.inventoryStatusFilter = undefined;
    
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
      {
        label: product.deletable
          ? this.translate.instant('delete_button')
          : this.translate.instant('archive_button'),
        icon: product.deletable
          ? 'pi pi-fw pi-trash'
          : 'pi pi-fw pi-folder',
        command: () => {
          if (product.deletable) {
            this.deleteProductEvent.emit(product);
          } else {
            this.archiveProductEvent.emit(product);
          }
        },
      },
    ];
  }
}
