import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LazyLoadEvent, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { lastValueFrom } from 'rxjs';
import { Category } from 'src/app/models/category';
import { Supplier } from 'src/app/models/supplier';
import { Warehouse } from 'src/app/models/warehouse';
import {
  ProductFamily,
  ProductFamilyInventoryOverview,
} from 'src/app/models/product-family';
import { ProductFamilyService } from 'src/app/services/product-family.service';
import { CategoryService } from 'src/app/services/category.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { ActivityProfileService } from 'src/app/services/activity-profile.service';
import { KeycloakService } from 'keycloak-angular';
import { getQuantitySeverity } from 'src/app/shared/product-utils';
import {
  initTablePageSizeState,
  persistTablePageSizeFromLazyEvent,
  TablePageSizeKeys,
} from 'src/app/utils/table-page-size.storage';

@Component({
  templateUrl: './product-families.component.html',
  styleUrls: ['../inventory.component.css', './product-families.component.css'],
  providers: [MessageService],
})
export class ProductFamiliesComponent implements OnInit {
  overviews: ProductFamilyInventoryOverview[] = [];
  expandedRows: { [key: number]: boolean } = {};

  rowsPerPageOptions = [20, 50, 100];
  totalRecords = 0;
  pageSize = 20;
  currentPage = 0;
  search = '';
  selectedWarehouseId: number | null = null;

  isLoading = false;
  private loadInProgress = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly SEARCH_DEBOUNCE_MS = 400;
  currency = 'USD';

  categories: Category[] = [];
  suppliers: Supplier[] = [];
  warehouses: Warehouse[] = [];

  familyFormVisible = false;
  familyFormMode: 'create' | 'edit' = 'create';
  editingFamily: ProductFamily | null = null;

  generateDialogVisible = false;
  generateFamily: ProductFamily | null = null;

  canAdd = false;
  isAdmin = false;

  constructor(
    private productFamilyService: ProductFamilyService,
    private categoryService: CategoryService,
    private supplierService: SupplierService,
    private warehouseService: WarehouseService,
    private configService: AppConfigurationService,
    private messageService: MessageService,
    private translate: TranslateService,
    private keycloakService: KeycloakService,
    private router: Router,
    public activityProfileService: ActivityProfileService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.activityProfileService.ensureLoaded();
    initTablePageSizeState(TablePageSizeKeys.productFamilies, this.rowsPerPageOptions, {
      pageSize: this.pageSize,
    });
    const roles = await this.keycloakService.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
    this.canAdd = this.isAdmin || roles.includes('WAREHOUSEMAN');
    this.configService.currency$.subscribe((currency) => {
      if (currency) {
        this.currency = currency;
      }
    });
    await this.loadLookups();
    // Data load is driven by p-table (onLazyLoad) to avoid duplicate fetch + NG0100.
  }

  private async loadLookups(): Promise<void> {
    try {
      this.categoryService.loadToken();
      this.supplierService.loadToken();
      this.warehouseService.loadToken();
      const [cats, sups, whs] = await Promise.all([
        lastValueFrom(this.categoryService.getCategories()),
        lastValueFrom(this.supplierService.getSuppliers()),
        lastValueFrom(this.warehouseService.getWarehouses()),
      ]);
      this.categories = (cats as Category[]) ?? [];
      this.suppliers = (sups as Supplier[]) ?? [];
      this.warehouses = (whs as Warehouse[]) ?? [];
    } catch {
      /* optional */
    }
  }

  async loadOverviews(page: number, size: number): Promise<void> {
    if (this.loadInProgress) {
      return;
    }
    this.loadInProgress = true;
    // Defer so lazy-load handlers do not flip bindings in the same CD cycle (NG0100).
    await Promise.resolve();
    this.isLoading = true;
    try {
      const res = await lastValueFrom(
        this.productFamilyService.getInventoryOverviewPage(
          page,
          size,
          this.search,
          this.selectedWarehouseId ?? undefined,
          true,
        ),
      );
      this.overviews = res.families ?? [];
      this.totalRecords = res.totalElements ?? 0;
      this.currentPage = res.currentPage ?? page;
      this.pageSize = res.pageSize ?? size;
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: err?.error?.message || this.translate.instant('product_family_load_failed'),
        life: 5000,
      });
      this.overviews = [];
      this.totalRecords = 0;
    } finally {
      this.isLoading = false;
      this.loadInProgress = false;
      this.cdr.markForCheck();
    }
  }

  onLazyLoad(event: LazyLoadEvent): void {
    if (this.loadInProgress) {
      return;
    }
    persistTablePageSizeFromLazyEvent(TablePageSizeKeys.productFamilies, this.rowsPerPageOptions, event, {
      pageSize: this.pageSize,
    });
    const page = event.first != null && event.rows ? Math.floor(event.first / event.rows) : 0;
    const size = event.rows ?? this.pageSize;
    void this.loadOverviews(page, size);
  }

  onSearchInput(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.searchDebounceTimer = null;
      this.reloadFromFirstPage();
    }, ProductFamiliesComponent.SEARCH_DEBOUNCE_MS);
  }

  onWarehouseFilterChange(): void {
    this.reloadFromFirstPage();
  }

  /** Reload page 0 without remounting the table (avoids duplicate onLazyLoad). */
  private reloadFromFirstPage(): void {
    void this.loadOverviews(0, this.pageSize);
  }

  openCreateFamily(): void {
    this.familyFormMode = 'create';
    this.editingFamily = null;
    this.familyFormVisible = true;
  }

  openEditFamily(overview: ProductFamilyInventoryOverview): void {
    this.familyFormMode = 'edit';
    this.editingFamily = { ...overview.family };
    this.familyFormVisible = true;
  }

  openGenerateVariants(overview: ProductFamilyInventoryOverview): void {
    this.generateFamily = { ...overview.family };
    this.generateDialogVisible = true;
  }

  onFamilySaved(): void {
    void this.loadOverviews(this.currentPage, this.pageSize);
  }

  onVariantsGenerated(): void {
    void this.loadOverviews(this.currentPage, this.pageSize);
  }

  toggleRow(familyId: number): void {
    this.expandedRows[familyId] = !this.expandedRows[familyId];
  }

  isRowExpanded(familyId: number): boolean {
    return !!this.expandedRows[familyId];
  }

  getQuantitySeverity = getQuantitySeverity;

  statusLabel(status?: string): string {
    if (!status) {
      return '';
    }
    return this.translate.instant(status.toLowerCase());
  }

  navigateToProduct(productId?: number): void {
    if (productId) {
      void this.router.navigate(['/inventory/products', productId]);
    }
  }

  goToProducts(): void {
    void this.router.navigate(['/inventory/products']);
  }
}
