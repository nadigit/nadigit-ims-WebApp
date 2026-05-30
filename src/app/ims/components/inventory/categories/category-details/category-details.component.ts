import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Category } from 'src/app/models/category';
import { Product } from 'src/app/models/product';
import { Supplier } from 'src/app/models/supplier';
import { Warehouse } from 'src/app/models/warehouse';
import { CategoryService } from 'src/app/services/category.service';
import { ProductService } from 'src/app/services/product.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { getMeasureUnit } from 'src/app/shared/product-utils';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { CategoryFormDialogComponent, CategoryFormDialogConfig, CategoryFormDialogData } from '../category-form-dialog/category-form-dialog.component';
import { Location } from '@angular/common';

@Component({
  templateUrl: './category-details.component.html',
  styleUrls: ['./category-details.component.css', '../../inventory.component.css'],
  providers: [MessageService]
})
export class CategoryDetailsComponent implements OnInit, OnDestroy {
  categoryId!: number;
  category: Category | null = null;
  isLoading: boolean = true;
  loadingCategoryDetails: boolean = false;
  currency: string = '';
  filteredCategoryProducts: Product[] = [];
  categoryStats: any = {};
  productSearchTerm: string = '';
  selectedWarehouseFilter: Warehouse | null = null;
  selectedStatusFilter: string | null = null;
  lowStockThreshold: number = 10;
  uniqueWarehouses: Warehouse[] = [];

  private readonly destroy$ = new Subject<void>();

  // Permissions
  canListProducts: boolean = false;
  canAddProduct: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canReadProduct: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "CATEGORIES";

  // Product related
  products: Product[] = [];
  selectedProduct: Product = {};
  productDetailDialog: boolean = false;
  productDialog: boolean = false;
  suppliers: Supplier[] = [];
  warehouses: Warehouse[] = [];
  categories: Category[] = [];
  deleteProductDialog: boolean = false;
  archiveProductDialog: boolean = false;
  submitted: boolean = false;
  canAddCategory: boolean = false;
  canAddSupplier: boolean = false;
  canAddWarehouse: boolean = false;

  // Dialog configuration for reusable component
  categoryDialogConfig: CategoryFormDialogConfig = {
    visible: false,
    mode: 'edit',
    category: {},
    isLoading: false
  };

  canEditCategory: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private messageService: MessageService,
    private categoryService: CategoryService,
    private productService: ProductService,
    private supplierService: SupplierService,
    private warehouseService: WarehouseService,
    private reportingService: ReportingService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.lowStockThreshold = await this.getLowStockThreshold();

    this.configService.configurationSaved$
      .pipe(takeUntil(this.destroy$))
      .subscribe((key) => {
        if (key === 'lowStockThreshold') {
          void this.getLowStockThreshold().then((t) => (this.lowStockThreshold = t));
        }
      });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.categoryId = +params['id'];
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadCategory();
      await this.loadCategoryDetails();
      // Load form data when needed
      await this.onGetAllCategories();
      await this.onGetAllWarehouses();
      await this.onGetAllSuppliers();
      this.isLoading = false;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadCategory(): Promise<void> {
    try {
      const categories = await firstValueFrom(this.categoryService.getCategories()) as Category[];
      this.category = categories.find((c: Category) => c.categoryId === this.categoryId) || null;
      if (!this.category) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('category_not_found'),
          life: 3000
        });
        this.router.navigate(['/inventory/categories']);
      }
    } catch (error) {
      console.error('Error loading category:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_category'),
        life: 3000
      });
      this.router.navigate(['/inventory/categories']);
    }
  }

  async loadCategoryDetails(): Promise<void> {
    this.loadingCategoryDetails = true;
    try {
      await this.onGetCategoryProducts();
      this.filteredCategoryProducts = [...this.products];
      this.updateUniqueWarehouses();
      this.calculateCategoryStats();
    } catch (error) {
      console.error('Error loading category details:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_category_products'),
        life: 3000
      });
    } finally {
      this.loadingCategoryDetails = false;
    }
  }

  editCategory() {
    if (!this.canEditCategory) return;
    this.categoryDialogConfig = {
      visible: true,
      mode: 'edit',
      category: { ...this.category },
      isLoading: false
    };
  }

  async saveCategory() {
    this.submitted = true;
    if (this.category.categoryName) {
      if (this.category.categoryId) {
        try {
          await this.updateCategory(this.category.categoryId, this.category);
        } catch (error) {
          console.error('Error updating category:', error);
        }
      }
      this.categoryDialogConfig.visible = false;
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
      return;
    }
  }

  async onGetCategoryProducts(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.categoryService.getCategoryProducts(this.categoryId)
        .subscribe({
          next: (response: any) => {
            this.products = response;
            resolve();
          },
          error: (err: any) => {
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: this.translate.instant('error_getting_products'),
              life: 3000
            });
            console.log(err);
            reject(err);
          }
        });
    });
  }


  async updateCategory(id: any, category: any): Promise<any> {
    await this.categoryService.updateCategory(id, category)
      .subscribe({
        next: (response: any) => {
          this.onGetAllCategories();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('category_updated'),
            life: 3000
          });
          return true;
        },
        error(err: any) {
          console.log(err);
          this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('error_updating_category'), life: 3000 })
          return false;
        },
      })
  }

  hideDialog() {
    this.categoryDialogConfig.visible = false;
    this.submitted = false;
  }

  // Category Form Dialog Event Handlers
  onCategoryDialogConfigChange(config: CategoryFormDialogConfig) {
    this.categoryDialogConfig = config;
  }

  onCategorySave(dialogData: CategoryFormDialogData) {
    this.category = dialogData.category;
    this.saveCategory();
  }

  onCategoryCancel() {
    this.hideDialog();
  }


  calculateCategoryStats(): void {
    const lowStockProducts = this.products.filter(p =>
      p.inventoryStatus === 'LOWSTOCK' || (p.quantityAvailable || 0) > 0 && (p.quantityAvailable || 0) <= (this.lowStockThreshold || 10)
    );

    const outOfStockProducts = this.products.filter(p =>
      p.inventoryStatus === 'OUTOFSTOCK' || (p.quantityAvailable || 0) === 0
    );

    const inStockProducts = this.products.filter(p =>
      (p.quantityAvailable || 0) > (this.lowStockThreshold || 10)
    );

    // Calculate warehouse distribution
    const warehouseMap = new Map<string, number>();
    this.products.forEach(p => {
      const warehouseName = p.warehouse?.name || 'Unassigned';
      warehouseMap.set(warehouseName, (warehouseMap.get(warehouseName) || 0) + 1);
    });

    // Get top products by value
    const topProductsByValue = [...this.products]
      .sort((a, b) => {
        const valueA = (a.quantityAvailable || 0) * (a.buyingPrice || 0);
        const valueB = (b.quantityAvailable || 0) * (b.buyingPrice || 0);
        return valueB - valueA;
      })
      .slice(0, 5);

    // Calculate profit metrics
    const productsWithProfit = this.products.filter(p => p.buyingPrice && p.sellingPrice);
    const averageProfit = productsWithProfit.length > 0
      ? productsWithProfit.reduce((sum, p) => {
        const profit = ((p.sellingPrice - p.buyingPrice) / p.buyingPrice) * 100;
        return sum + profit;
      }, 0) / productsWithProfit.length
      : 0;

    this.categoryStats = {
      totalProducts: this.products.length,
      totalQuantity: this.products.reduce((sum, p) => sum + (p.quantityAvailable || 0), 0),
      totalValue: this.products.reduce((sum, p) => sum + ((p.quantityAvailable || 0) * (p.buyingPrice || 0)), 0),
      totalSalesValue: this.products.reduce((sum, p) => sum + ((p.quantityAvailable || 0) * (p.sellingPrice || 0)), 0),
      inStockCount: inStockProducts.length,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      warehouseDistribution: Array.from(warehouseMap.entries()).map(([name, count]) => ({ name, count })),
      topProductsByValue: topProductsByValue,
      averageValue: this.products.length > 0
        ? this.products.reduce((sum, p) => sum + ((p.quantityAvailable || 0) * (p.buyingPrice || 0)), 0) / this.products.length
        : 0,
      averageProfit: averageProfit,
      potentialProfit: this.products.reduce((sum, p) => {
        if (p.quantityAvailable && p.buyingPrice && p.sellingPrice) {
          return sum + ((p.quantityAvailable) * (p.sellingPrice - p.buyingPrice));
        }
        return sum;
      }, 0)
    };
  }

  filterCategoryProducts(): void {
    let filtered = [...this.products];

    // Filter by search term
    if (this.productSearchTerm) {
      const searchLower = this.productSearchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(searchLower) ||
        p.reference?.toLowerCase().includes(searchLower) ||
        p.supplier?.name?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by warehouse
    if (this.selectedWarehouseFilter) {
      filtered = filtered.filter(p =>
        p.warehouse?.warehouseId === this.selectedWarehouseFilter.warehouseId
      );
    }

    // Filter by status
    if (this.selectedStatusFilter) {
      if (this.selectedStatusFilter === 'INSTOCK') {
        filtered = filtered.filter(p => (p.quantityAvailable || 0) > (this.lowStockThreshold || 10));
      } else if (this.selectedStatusFilter === 'LOWSTOCK') {
        filtered = filtered.filter(p => (p.quantityAvailable || 0) > 0 && (p.quantityAvailable || 0) <= (this.lowStockThreshold || 10));
      } else if (this.selectedStatusFilter === 'OUTOFSTOCK') {
        filtered = filtered.filter(p => (p.quantityAvailable || 0) === 0);
      }
    }

    this.filteredCategoryProducts = filtered;
  }

  clearCategoryProductFilters(): void {
    this.productSearchTerm = '';
    this.selectedWarehouseFilter = null;
    this.selectedStatusFilter = null;
    this.filteredCategoryProducts = [...this.products];
  }

  updateUniqueWarehouses(): void {
    const warehouseMap = new Map<number, Warehouse>();
    this.products.forEach(p => {
      if (p.warehouse && !warehouseMap.has(p.warehouse.warehouseId)) {
        warehouseMap.set(p.warehouse.warehouseId, p.warehouse);
      }
    });
    this.uniqueWarehouses = Array.from(warehouseMap.values());
  }

  refreshCategoryDetails(): void {
    if (this.category?.categoryId) {
      this.loadingCategoryDetails = true;
      this.onGetCategoryProducts().then(() => {
        this.filteredCategoryProducts = [...this.products];
        this.updateUniqueWarehouses();
        this.calculateCategoryStats();
        this.loadingCategoryDetails = false;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('data_refreshed'),
          life: 2000
        });
      }).catch(error => {
        console.error('Error refreshing category details:', error);
        this.loadingCategoryDetails = false;
      });
    }
  }

  exportCategoryProducts(): void {
    const exportData = this.filteredCategoryProducts.map(p => ({
      name: p.name,
      reference: p.reference,
      warehouse: p.warehouse?.name || 'N/A',
      quantity: p.quantityAvailable || 0,
      buyingPrice: p.buyingPrice || 0,
      sellingPrice: p.sellingPrice || 0,
      value: (p.quantityAvailable || 0) * (p.buyingPrice || 0),
      status: p.inventoryStatus || 'N/A'
    }));

    this.reportingService.exportExcel(
      exportData,
      `category_${this.category.categoryName}_products`
    );
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canListProducts = this.permissionService.canListProducts(this.Ressource);
    this.canAddProduct = this.permissionService.canCreate('PRODUCTS');
    this.canEditProduct = this.permissionService.canUpdate('PRODUCTS');
    this.canDeleteProduct = this.permissionService.canDelete('PRODUCTS');
    this.canReadProduct = this.permissionService.canRead('PRODUCTS');
    this.canEditCategory = this.permissionService.canUpdate(this.Ressource);
    this.canAddCategory = this.permissionService.canCreate('CATEGORIES');
    this.canAddSupplier = this.permissionService.canCreate('SUPPLIERS');
    this.canAddWarehouse = this.permissionService.canCreate('WAREHOUSES');
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  async getLowStockThreshold(): Promise<number> {
    let threshold: any;
    try {
      const value = await firstValueFrom(await this.configService.getConfiguration('lowStockThreshold'));

      threshold = (value !== undefined && value !== null)
        ? Number(value.value)
        : 10;
      return threshold;
    } catch (error) {
      console.error('Error fetching low stock threshold:', error);
      threshold = 10; // fallback value
      return threshold;
    }
  }

  getQuantitySeverity(quantity: number): string {
    if (quantity === undefined || quantity === null) return 'info';
    if (quantity <= 0) return 'danger';
    if (quantity < this.lowStockThreshold) return 'warning';
    return 'success';
  }

  calculateProfit(product: any): number {
    if (!product.sellingPrice || !product.buyingPrice) return 0;
    return (product.sellingPrice - product.buyingPrice) / product.buyingPrice;
  }

  getProfitClass(product: any): string {
    const profit = this.calculateProfit(product);
    return profit >= 0.3 ? 'text-green-500 font-semibold' :
      profit >= 0.1 ? 'text-blue-500' : 'text-orange-500';
  }

  getMeasureUnit(unit: string, quantity: number): string {
    return getMeasureUnit(unit, quantity);
  }

  viewProductDetails(product: Product) {
    this.router.navigate(['/inventory/products', product.productId]);
  }

  // Convert attribute value for display
  displayAttributeValue(attr: any): string {
    if (!attr) return '';
    switch (attr.attributeType) {
      case 'BOOLEAN':
        return attr.booleanValue ? 'Yes' : 'No';
      case 'INTEGER':
        return attr.intValue?.toString() || '';
      case 'DOUBLE':
        return attr.doubleValue?.toFixed(2) || '';
      default:
        return attr.stringValue || '';
    }
  }

  editProduct(product: Product) {
    if (!this.canEditProduct) return;
    this.selectedProduct = product;
    // Ensure form data is loaded
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.onGetAllSuppliers();
    this.productDialog = true;
  }

  async onProductFormSaveSuccess(productData: Product): Promise<void> {
    console.log('Product form saved successfully:', productData);
    // Reset selected product
    this.selectedProduct = {};
    // Close dialog first
    this.productDialog = false;
    // Reload category details to refresh products list and stats
    await this.loadCategoryDetails();
    // Ensure filtered products are updated
    this.filteredCategoryProducts = [...this.products];
  }

  onProductFormSaveError(event: { product: Product, error: any }): void {
    console.error('Product form save error:', event.error);
    // Error message is already displayed by the form component
  }

  openCategoryDialog(): void {
    // Navigate to categories page or open category dialog
    this.router.navigate(['/inventory/categories']);
  }

  openSupplierDialog(): void {
    // Navigate to suppliers page or open supplier dialog
    this.router.navigate(['/inventory/suppliers']);
  }

  openWarehouseDialog(): void {
    // Navigate to warehouses page or open warehouse dialog
    this.router.navigate(['/inventory/warehouses']);
  }

  deleteProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.deleteProductDialog = true;
    this.selectedProduct = { ...product };
  }

  async confirmProductDelete() {
    if (!this.canDeleteProduct) return;
    this.deleteProductDialog = false;
    await this.onDeleteProduct(this.selectedProduct.productId);
    this.selectedProduct = {};
  }

  async onDeleteProduct(id: any) {
    await this.productService.deleteProduct(id)
      .subscribe({
        next: async (response: any) => {
          console.log(response);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_deleted'),
            life: 3000
          });
          await this.loadCategoryDetails();
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_deleting_product'),
            life: 3000
          });
          console.log(err);
        },
      })
  }


  async onGetAllWarehouses() {
    await this.warehouseService.getWarehouses().subscribe({
      next: (response: any) => {
        this.warehouses = response;
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_warehouses'),
          life: 3000,
        });
        console.log(err);
      },
    });
  }

  async onGetAllSuppliers() {
    await this.supplierService.getSuppliers()
      .subscribe({
        next: (response: any) => {
          this.suppliers = response;
        },
        error: (err: any) => {
          console.error(err)
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_getting_suppliers'),
            life: 3000
          });
        },
      })
  }

  async onGetAllCategories() {
    await this.categoryService.getCategories()
      .subscribe({
        next: (response: any) => {
          this.categories = response;
        },
        error: (err: any) => {
          console.error(err);
        },
      })
  }


  archiveProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.archiveProductDialog = true;
    this.selectedProduct = { ...product };
    this.productDialog = false;
  }

  async confirmArchive() {
    if (!this.canDeleteProduct) return;
    this.archiveProductDialog = false;
    await this.onArchiveProduct(this.selectedProduct.productId);
    this.selectedProduct = {};
  }

  async onArchiveProduct(id: any) {
    await this.productService.deactivateProduct(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_archived'),
            life: 3000
          });
          this.onGetAllWarehouses();
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_archiving_product'),
            life: 3000
          });
          console.log(err);
        },
      })
  }

  hideProductDialog() {
    this.productDialog = false;
    this.submitted = false;
  }

  goBack(): void {
    this.location.back();
  }

  /** Warehouse filter is only useful when the user can see multiple warehouses (admins, or org-scoped lists). */
  get showWarehouseFilterInCategory(): boolean {
    return this.isAdmin || (this.uniqueWarehouses?.length ?? 0) > 1;
  }
}

