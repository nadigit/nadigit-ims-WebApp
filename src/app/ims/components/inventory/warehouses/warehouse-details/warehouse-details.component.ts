import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Warehouse } from 'src/app/models/warehouse';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Product } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';
import { Category } from 'src/app/models/category';
import { CategoryService } from 'src/app/services/category.service';
import { ReportingService } from 'src/app/utils/reporting.service';
import { LocationService } from 'src/app/services/location.service';

@Component({
  templateUrl: './warehouse-details.component.html',
  styleUrls: ['./warehouse-details.component.css', '../../inventory.component.css'],
  providers: [MessageService]
})
export class WarehouseDetailsComponent implements OnInit {

  warehouseId!: number;
  warehouse: Warehouse | null = null;
  warehouseProducts: Product[] = [];
  filteredWarehouseProducts: Product[] = [];
  warehouseStats: any = {};
  loadingWarehouseDetails: boolean = false;
  productSearchTerm: string = '';
  selectedCategoryFilter: Category | null = null;
  selectedStatusFilter: string | null = null;
  uniqueCategories: Category[] = [];
  inventoryStatuses = [
    { label: 'in_stock', value: 'INSTOCK' },
    { label: 'low_stock', value: 'LOWSTOCK' },
    { label: 'out_of_stock', value: 'OUTOFSTOCK' }
  ];

  canAddProduct: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canReadProduct: boolean = false;
  isAdmin: boolean = false;
  lowStockThreshold: number = 10;
  currency: string = 'USD';

  selectedProduct: Product | null = null;
  productDetailDialog: boolean = false;
  deleteProductDialog: boolean = false;
  archiveProductDialog: boolean = false;
  productDialog: boolean = false;
  submitted: boolean = false;
  categories: Category[] = [];
  suppliers: any[] = [];
  warehouses: Warehouse[] = [];
  measureUnits: any[] = [];
  attributeTypes: any[] = [];
  uploadedFile: File | null = null;
  imageURL: string | null = null;
  userRoles: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private warehouseService: WarehouseService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private reportingService: ReportingService,
    private locationService: LocationService
  ) { }

  async ngOnInit() {
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.loadingWarehouseDetails = true;
      try {
        this.warehouseId = +params['id'];
        if (!this.warehouseId || isNaN(this.warehouseId)) {
          this.loadingWarehouseDetails = false;
          this.router.navigate(['/inventory/warehouses']);
          return;
        }
        await this.checkPermissions();
        await this.loadWarehouse();
        if (this.warehouse) {
          await this.loadWarehouseDetails();
          this.lowStockThreshold = await this.getLowStockThreshold();
        }
      } catch (error) {
        console.error('Error initializing warehouse details:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_warehouse_details'),
          life: 3000
        });
        // Don't navigate if already navigating
        if (this.warehouseId && !isNaN(this.warehouseId)) {
          this.router.navigate(['/inventory/warehouses']);
        }
      } finally {
        this.loadingWarehouseDetails = false;
      }
    });
  }

  async checkPermissions() {
    try {
      const profile = await this.keycloakService.loadUserProfile();
      const userId = profile.id;
      await firstValueFrom(this.permissionService.init(userId));
      this.canEditProduct = this.permissionService.canUpdate('PRODUCTS');
      this.canDeleteProduct = this.permissionService.canDelete('PRODUCTS');
      this.canReadProduct = this.permissionService.canRead('PRODUCTS');
      await this.setUserRoles();
    } catch (error) {
      console.error('Error checking permissions:', error);
      // Set default permissions if check fails
      this.canEditProduct = false;
      this.canDeleteProduct = false;
      this.canReadProduct = false;
    }
  }

  async loadWarehouse() {
    try {
      const warehouses = await firstValueFrom(this.warehouseService.getWarehouses()) as Warehouse[];
      this.warehouse = warehouses.find((w: Warehouse) => w.warehouseId === this.warehouseId) || null;
      if (!this.warehouse) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('warehouse_not_found'),
          life: 3000
        });
        throw new Error('Warehouse not found');
      }
    } catch (error) {
      console.error('Error loading warehouse:', error);
      if (error instanceof Error && error.message !== 'Warehouse not found') {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_warehouse'),
          life: 3000
        });
      }
      throw error; // Re-throw to let caller handle navigation
    }
  }

  async loadWarehouseDetails() {
    if (!this.warehouseId) return;
    try {
      const products = await firstValueFrom(this.warehouseService.getProductsByWarehouse(this.warehouseId)) as Product[];
      this.warehouseProducts = products || [];
      this.filteredWarehouseProducts = [...this.warehouseProducts];
      this.updateUniqueCategories();
      this.calculateWarehouseStats();
    } catch (error) {
      console.error('Error loading warehouse details:', error);
      this.warehouseProducts = [];
      this.filteredWarehouseProducts = [];
      this.uniqueCategories = [];
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_warehouse_details'),
        life: 3000
      });
      throw error; // Re-throw to let caller handle
    }
  }

  calculateWarehouseStats() {
    const lowStockProducts = this.warehouseProducts.filter(p => 
      p.inventoryStatus === 'LOWSTOCK' || (p.quantityAvailable || 0) <= (this.lowStockThreshold || 10)
    );
    
    const outOfStockProducts = this.warehouseProducts.filter(p => 
      p.inventoryStatus === 'OUTOFSTOCK' || (p.quantityAvailable || 0) === 0
    );

    const categoryMap = new Map<string, number>();
    this.warehouseProducts.forEach(p => {
      const categoryName = p.category?.categoryName || 'Uncategorized';
      categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + 1);
    });

    const topProductsByValue = [...this.warehouseProducts]
      .sort((a, b) => {
        const valueA = (a.quantityAvailable || 0) * (a.buyingPrice || 0);
        const valueB = (b.quantityAvailable || 0) * (b.buyingPrice || 0);
        return valueB - valueA;
      })
      .slice(0, 5);

    this.warehouseStats = {
      totalProducts: this.warehouseProducts.length,
      totalQuantity: this.warehouseProducts.reduce((sum, p) => sum + (p.quantityAvailable || 0), 0),
      totalValue: this.warehouseProducts.reduce((sum, p) => sum + ((p.quantityAvailable || 0) * (p.buyingPrice || 0)), 0),
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      categoryDistribution: Array.from(categoryMap.entries()).map(([name, count]) => ({ name, count })),
      topProductsByValue: topProductsByValue,
      averageValue: this.warehouseProducts.length > 0 
        ? this.warehouseProducts.reduce((sum, p) => sum + ((p.quantityAvailable || 0) * (p.buyingPrice || 0)), 0) / this.warehouseProducts.length
        : 0
    };
  }

  filterProducts(): void {
    if (!this.warehouseProducts || this.warehouseProducts.length === 0) {
      this.filteredWarehouseProducts = [];
      return;
    }

    let filtered = [...this.warehouseProducts];

    if (this.productSearchTerm) {
      const searchLower = this.productSearchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(searchLower) ||
        p.reference?.toLowerCase().includes(searchLower) ||
        p.category?.categoryName?.toLowerCase().includes(searchLower)
      );
    }

    if (this.selectedCategoryFilter && this.selectedCategoryFilter.categoryId) {
      filtered = filtered.filter(p => 
        p?.category?.categoryId === this.selectedCategoryFilter.categoryId
      );
    }

    if (this.selectedStatusFilter) {
      filtered = filtered.filter(p => p.inventoryStatus === this.selectedStatusFilter);
    }

    this.filteredWarehouseProducts = filtered;
  }

  clearProductFilters(): void {
    this.productSearchTerm = '';
    this.selectedCategoryFilter = null;
    this.selectedStatusFilter = null;
    this.filteredWarehouseProducts = this.warehouseProducts ? [...this.warehouseProducts] : [];
  }

  updateUniqueCategories(): void {
    try {
      if (!this.warehouseProducts || this.warehouseProducts.length === 0) {
        this.uniqueCategories = [];
        return;
      }
      const categoryMap = new Map<number, Category>();
      this.warehouseProducts.forEach(p => {
        if (p?.category && p.category.categoryId && !categoryMap.has(p.category.categoryId)) {
          categoryMap.set(p.category.categoryId, p.category);
        }
      });
      this.uniqueCategories = Array.from(categoryMap.values());
    } catch (error) {
      console.error('Error updating unique categories:', error);
      this.uniqueCategories = [];
    }
  }

  getUniqueCategories(): Category[] {
    return this.uniqueCategories;
  }

  exportWarehouseProducts(): void {
    const exportData = this.filteredWarehouseProducts.map(p => ({
      name: p.name,
      reference: p.reference,
      category: p.category?.categoryName || 'N/A',
      quantity: p.quantityAvailable || 0,
      status: p.inventoryStatus,
      buyingPrice: p.buyingPrice || 0,
      sellingPrice: p.sellingPrice || 0,
      value: (p.quantityAvailable || 0) * (p.buyingPrice || 0)
    }));

    this.reportingService.exportExcel(
      exportData,
      `warehouse_${this.warehouse?.name}_products`
    );
  }

  getStatusCount(status: string): number {
    return this.warehouseProducts.filter(p => p.inventoryStatus === status).length;
  }

  getStatusIcon(status: string): string {
    switch (status.toLowerCase()) {
      case 'instock': return 'pi pi-check-circle text-green-500';
      case 'lowstock': return 'pi pi-exclamation-circle text-orange-500';
      case 'outofstock': return 'pi pi-times-circle text-red-500';
      default: return 'pi pi-question-circle text-gray-500';
    }
  }

  async refreshWarehouseDetails(): Promise<void> {
    await this.loadWarehouseDetails();
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('success'),
      detail: this.translate.instant('data_refreshed'),
      life: 2000
    });
  }

  getMeasureUnit(unit: string, quantity: number): string {
    if (!unit) return 'UNIT';

    const pluralizable = ['UNIT', 'PIECE', 'BOX', 'METER'];

    if (quantity > 1 && pluralizable.includes(unit)) {
      return `${unit}_plural`;
    }

    return unit;
  }

  getQuantitySeverity(quantity: number): string {
    if (quantity === undefined || quantity === null) return 'info';
    if (quantity <= 0) return 'danger';
    if (quantity < this.lowStockThreshold) return 'warning';
    return 'success';
  }

  async getLowStockThreshold(): Promise<number> {
    try {
      const value = await firstValueFrom(await this.configService.getConfiguration('lowStockThreshold'));
      return (value !== undefined && value !== null)
        ? Number(value.value)
        : 10;
    } catch (error) {
      console.error('Error fetching low stock threshold:', error);
      return 10;
    }
  }

  viewProductDetails(product: Product) {
    this.router.navigate(['/inventory/products', product.productId]);
  }

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
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.productDialog = true;
  }

  calculateProfit(product: Product): number {
    if (!product.sellingPrice || !product.buyingPrice) return 0;
    return (product.sellingPrice - product.buyingPrice) / product.buyingPrice;
  }

  deleteProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.deleteProductDialog = true;
    this.selectedProduct = { ...product };
  }

  async confirmProductDelete() {
    if (!this.canDeleteProduct || !this.selectedProduct?.productId) return;
    this.deleteProductDialog = false;
    await this.onDeleteProduct(this.selectedProduct.productId);
    this.selectedProduct = null;
  }

  async onDeleteProduct(id: any) {
    await this.productService.deleteProduct(id)
      .subscribe({
        next: async (response: any) => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_deleted'),
            life: 3000
          });
          await this.loadWarehouseDetails();
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

  archiveProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.archiveProductDialog = true;
    this.selectedProduct = { ...product };
  }

  async confirmArchive() {
    if (!this.canDeleteProduct) return;
    this.archiveProductDialog = false;
    // Archive logic here
    this.selectedProduct = null;
  }

  async onGetAllCategories() {
    await this.categoryService.getCategories().subscribe({
      next: async (response: any) => {
        this.categories = response;
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_categories'),
          life: 3000,
        });
        console.log(err);
      },
    });
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

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  goBack(): void {
    this.router.navigate(['/inventory/warehouses']);
  }
}

