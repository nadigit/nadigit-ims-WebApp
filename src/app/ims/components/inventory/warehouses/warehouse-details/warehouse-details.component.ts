import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Warehouse } from 'src/app/models/warehouse';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Product } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';
import { Category } from 'src/app/models/category';
import { CategoryService } from 'src/app/services/category.service';
import { ReportingService } from 'src/app/utils/reporting.service';
import { LocationService } from 'src/app/services/location.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { Supplier } from 'src/app/models/supplier';
import { InventoryWriteOff } from 'src/app/models/write-off';
import { WriteOffService } from 'src/app/services/write-off.service';
import { WarehouseFormDialogComponent, WarehouseFormDialogConfig, WarehouseFormDialogData } from '../warehouse-form-dialog/warehouse-form-dialog.component';
import { Location } from '@angular/common';

@Component({
  templateUrl: './warehouse-details.component.html',
  styleUrls: ['./warehouse-details.component.css', '../../inventory.component.css'],
  providers: [MessageService]
})
export class WarehouseDetailsComponent implements OnInit, OnDestroy {

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
  inventoryStatuses: any[] = [];

  canAddProduct: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canReadProduct: boolean = false;
  canEditWarehouse: boolean = false;
  canDeleteWarehouse: boolean = false;
  canReadWarehouse: boolean = false;
  isAdmin: boolean = false;
  lowStockThreshold: number = 10;
  currency: string = 'USD';

  private readonly destroy$ = new Subject<void>();

  selectedProduct: Product | null = null;
  productDetailDialog: boolean = false;
  deleteProductDialog: boolean = false;
  archiveProductDialog: boolean = false;
  productDialog: boolean = false;
  submitted: boolean = false;
  categories: Category[] = [];
  suppliers: any[] = [];
  warehouses: Warehouse[] = [];
  userRoles: string[] = [];
  canAddCategory: boolean = false;
  canAddSupplier: boolean = false;
  canAddWarehouse: boolean = false;

  selectedCountry: any = null;
  countries: any = null;
  states: any = null;
  warehouseDialogConfig: WarehouseFormDialogConfig = {
    visible: false,
    mode: 'edit',
    warehouse: {},
    selectedCountry: {},
    submitted: false
  };
  deleteWarehouseDialog: boolean = false;
  costingMethods: any[] = [];

  // Write-Offs Management
  writeOffs: InventoryWriteOff[] = [];
  writeOffsLoading: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private messageService: MessageService,
    private warehouseService: WarehouseService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private locationService: LocationService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private supplierService: SupplierService,
    private reportingService: ReportingService,
    private writeOffService: WriteOffService
  ) {
    this.costingMethods = [
      { label: this.translate.instant('costing_method_fifo'), value: 'FIFO' },
      { label: this.translate.instant('costing_method_lifo'), value: 'LIFO' },
      { label: this.translate.instant('costing_method_weighted_average'), value: 'WEIGHTED_AVERAGE' },
      { label: this.translate.instant('costing_method_standard_cost'), value: 'STANDARD_COST' },
      { label: this.translate.instant('costing_method_none'), value: 'NONE' }
    ];
  }

  async ngOnInit() {
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.configService.configurationSaved$
      .pipe(takeUntil(this.destroy$))
      .subscribe((key) => {
        if (key === 'lowStockThreshold') {
          void this.getLowStockThreshold().then((t) => (this.lowStockThreshold = t));
        }
      });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.countries = this.locationService.getAllCountriesWithTranslation();
    });

    this.inventoryStatuses = [
      { label: this.translate.instant('in_stock'), value: 'INSTOCK' },
      { label: this.translate.instant('low_stock'), value: 'LOWSTOCK' },
      { label: this.translate.instant('out_of_stock'), value: 'OUTOFSTOCK' }
    ];

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
          await this.loadWriteOffs(); // Load write-offs for warehouse
          this.lowStockThreshold = await this.getLowStockThreshold();
          // Load form data when needed
          await this.onGetAllCategories();
          await this.onGetAllWarehouses();
          await this.onGetAllSuppliers();
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async checkPermissions() {
    try {
      const profile = await this.keycloakService.loadUserProfile();
      const userId = profile.id;
      await firstValueFrom(this.permissionService.init(userId));
      this.canEditProduct = this.permissionService.canUpdate('PRODUCTS');
      this.canDeleteProduct = this.permissionService.canDelete('PRODUCTS');
      this.canReadProduct = this.permissionService.canRead('PRODUCTS');
      this.canEditWarehouse = this.permissionService.canUpdate('WAREHOUSES');
      this.canDeleteWarehouse = this.permissionService.canDelete('WAREHOUSES');
      this.canReadWarehouse = this.permissionService.canRead('WAREHOUSES');
      this.canAddCategory = this.permissionService.canCreate('CATEGORIES');
      this.canAddSupplier = this.permissionService.canCreate('SUPPLIERS');
      this.canAddWarehouse = this.permissionService.canCreate('WAREHOUSES');
      await this.setUserRoles();
    } catch (error) {
      console.error('Error checking permissions:', error);
      // Set default permissions if check fails
      this.canEditProduct = false;
      this.canDeleteProduct = false;
      this.canReadProduct = false;
      this.canEditWarehouse = false;
      this.canDeleteWarehouse = false;
      this.canReadWarehouse = false;
      this.canAddCategory = false;
      this.canAddSupplier = false;
      this.canAddWarehouse = false;
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

  editWarehouse() {
    if (!this.canEditWarehouse) return;
    this.selectedCountry = {};
    this.warehouseDialogConfig = {
      visible: true,
      mode: 'edit',
      warehouse: { ...this.warehouse },
      selectedCountry: {},
      submitted: false
    };
    this.onSelectedCountry(this.warehouse.country)
  }

  onWarehouseSave(dialogData: WarehouseFormDialogData) {
    this.warehouse = dialogData.warehouse;
    this.selectedCountry = dialogData.selectedCountry;
    this.saveWarehouse();
  }

  onWarehouseDialogConfigChange(config: WarehouseFormDialogConfig) {
    this.warehouseDialogConfig = config;
  }

  onWarehouseCancel() {
    this.hideDialog();
  }

  saveWarehouse() {
    this.warehouseDialogConfig.submitted = true;
    if (this.warehouse.name) {
      if (this.warehouse.warehouseId) {
        this.updateWarehouse(this.warehouse.warehouseId, this.warehouse)
          ? this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('warehouse_updated'),
            life: 3000
          })
          : this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_updating_warehouse'),
            life: 3000
          });
      }
      this.warehouseDialogConfig.visible = false;
      this.loadWarehouseDetails(); // Reload warehouse details after update
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

  async updateWarehouse(id: any, warehouse: any): Promise<any> {
    console.log(warehouse)
    await this.warehouseService.updateWarehouse(id, warehouse)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllWarehouses();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  onChangeCountry() {
    this.warehouse.city = undefined;
    console.log("clear city")
  }

  onSelectedCountry(event) {
    if ((this.warehouse.country != this.selectedCountry) && (this.warehouse.city == undefined)) this.warehouse.city = undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    this.states = this.locationService.getStatesByCountryCode(this.selectedCountry.isoCode);
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
    // Ensure form data is loaded
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.onGetAllSuppliers();
    this.productDialog = true;
  }

  async onProductFormSaveSuccess(productData: Product): Promise<void> {
    console.log('Product form saved successfully:', productData);
    // Reset selected product
    this.selectedProduct = null;
    // Close dialog first
    this.productDialog = false;
    // Reload warehouse details to refresh products list and stats
    await this.loadWarehouseDetails();
    // Ensure filtered products are updated
    this.filteredWarehouseProducts = [...this.warehouseProducts];
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

  async onGetAllSuppliers() {
    await this.supplierService.getSuppliers().subscribe({
      next: (response: any) => {
        this.suppliers = response;
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_suppliers'),
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
    this.location.back();
  }

  hideDialog(): void {
    this.warehouseDialogConfig.visible = false;
    this.warehouseDialogConfig.submitted = false;
    this.selectedCountry = {};
  }

  hideProductDialog(): void {
    this.productDialog = false;
  }

  // ==================== WRITE-OFFS MANAGEMENT ====================

  async loadWriteOffs(): Promise<void> {
    if (!this.warehouseId) return;

    this.writeOffsLoading = true;
    try {
      this.writeOffService.loadToken();
      const response: any = await firstValueFrom(await this.writeOffService.getWriteOffsByWarehouse(this.warehouseId));
      
      if (Array.isArray(response)) {
        this.writeOffs = response.map((writeOff: any) => ({
          ...writeOff,
          // Handle flat format from backend (productId, warehouseId, productName, warehouseName)
          product: writeOff.product || (writeOff.productId ? {
            productId: writeOff.productId,
            name: writeOff.productName,
            reference: writeOff.productReference
          } : null),
          warehouse: writeOff.warehouse || (writeOff.warehouseId ? {
            warehouseId: writeOff.warehouseId,
            name: writeOff.warehouseName
          } : null),
          writeOffDate: writeOff.writeOffDate ? new Date(writeOff.writeOffDate) : null,
          approvedDate: writeOff.approvedDate ? new Date(writeOff.approvedDate) : null,
          rejectedDate: writeOff.rejectedDate ? new Date(writeOff.rejectedDate) : null,
          creationDate: writeOff.creationDate ? new Date(writeOff.creationDate) : null
        }));
      } else {
        this.writeOffs = [];
      }

      // Sort write-offs by date (most recent first)
      this.writeOffs.sort((a, b) => {
        const dateA = a.writeOffDate ? new Date(a.writeOffDate).getTime() : 0;
        const dateB = b.writeOffDate ? new Date(b.writeOffDate).getTime() : 0;
        return dateB - dateA;
      });
    } catch (error: any) {
      console.error('Error loading write-offs:', error);
      // Don't show error if write-offs endpoint doesn't exist yet (404), just set empty array
      if (error?.status !== 404) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('error_loading_write_offs') || 'Could not load write-offs',
          life: 3000
        });
      }
      this.writeOffs = [];
    } finally {
      this.writeOffsLoading = false;
    }
  }

  getWriteOffStatusSeverity(status: string | undefined): string {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s === 'PENDING') return 'warning';
    if (s === 'APPROVED') return 'success';
    if (s === 'REJECTED') return 'danger';
    return '';
  }

  getWriteOffConditionSeverity(condition: string | undefined): string {
    if (!condition) return '';
    const c = condition.toUpperCase();
    if (c === 'DAMAGED' || c === 'UNUSABLE') return 'danger';
    if (c === 'LOST') return 'warn';
    if (c === 'EXPIRED') return 'info';
    return '';
  }

  getWriteOffConditionLabel(condition: string | undefined): string {
    if (!condition) return 'N/A';
    const key = `item_condition_${condition.toLowerCase()}`;
    return this.translate.instant(key) || condition;
  }

  getWriteOffSourceTypeLabel(sourceType: string | undefined): string {
    if (!sourceType) return 'N/A';
    const key = `write_off_source_type_${sourceType.toLowerCase().replace(/_/g, '_')}`;
    return this.translate.instant(key) || sourceType;
  }

  formatWriteOffDate(date: Date | string | null | undefined): string {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString();
    } catch {
      return String(date);
    }
  }

  formatWriteOffCurrency(amount: number | null | undefined): string {
    if (amount == null || amount === undefined || isNaN(amount)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  getTotalWriteOffQuantity(): number {
    return this.writeOffs.reduce((sum, wo) => sum + (wo.quantity || 0), 0);
  }

  getTotalWriteOffCost(): number {
    return this.writeOffs.reduce((sum, wo) => sum + (wo.writeOffCost || 0), 0);
  }

  viewWriteOffDetails(writeOff: InventoryWriteOff) {
    if (!writeOff.writeOffId) return;
    this.router.navigate(['/inventory/write-offs', writeOff.writeOffId]);
  }

  getWriteOffReasonLabel(reason: string | undefined): string {
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

