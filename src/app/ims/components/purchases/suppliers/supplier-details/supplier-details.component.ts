import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Supplier } from 'src/app/models/supplier';
import { SupplierService } from 'src/app/services/supplier.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Product } from 'src/app/models/product';
import { Purchase } from 'src/app/models/purchase';
import { LocationService } from 'src/app/services/location.service';
import { CategoryService } from 'src/app/services/category.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { Warehouse } from 'src/app/models/warehouse';
import { Category } from 'src/app/models/category';
import { SupplierFormDialogComponent, SupplierFormDialogConfig, SupplierFormDialogData } from '../supplier-form-dialog/supplier-form-dialog.component';
import { Location } from '@angular/common';

@Component({
  templateUrl: './supplier-details.component.html',
  styleUrls: [
    './supplier-details.component.css',
    '../suppliers.component.css',
    '../../purchases.component.css',
  ],
  providers: [MessageService]
})
export class SupplierDetailsComponent implements OnInit {

  supplierId!: number;
  supplier: Supplier | null = null;
  supplierProducts: Product[] = [];
  supplierPurchases: Purchase[] = [];

  isLoading: boolean = true;
  currency: string = 'USD';

  monthlyPurchasesChartData: any;
  productDistributionChartData: any;
  barChartOptions: any;
  pieChartOptions: any;

  canEditSupplier: boolean = false;
  Ressource: string = 'SUPPLIERS';

  // Dialog configuration for reusable component
  supplierDialogConfig: SupplierFormDialogConfig = {
    visible: false,
    mode: 'edit',
    supplier: {},
  };

  submitted: boolean = false;
  countries: any;

  categories: Category[] = [];
  warehouses: Warehouse[] = [];
  suppliers: Supplier[] = [];
  selectedProduct: Product | null = null;
  productDialog: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canReadProduct: boolean = false;
  filteredSupplierProducts: Product[] = [];
  canAddCategory: boolean = false;
  canAddWarehouse: boolean = false;
  canAddSupplier: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  lowStockThreshold: number = 10;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private messageService: MessageService,
    private supplierService: SupplierService,
    private categoryService: CategoryService,
    private warehouseService: WarehouseService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private locationService: LocationService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.countries = this.locationService.getAllCountriesWithTranslation();
    });

    this.route.params.subscribe(async params => {
      this.supplierId = +params['id'];
      await this.checkPermissions();
      await this.loadSupplier();
      if (this.supplier) {
        await this.loadSupplierProducts();
        await this.loadSupplierPurchases();
        this.initChartOptions();
        // Load form data when needed
        await this.onGetAllCategories();
        await this.onGetAllWarehouses();
        await this.onGetAllSuppliers();
      }
      this.isLoading = false;
    });
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.setUserRoles();
    await this.permissionService.init(userId).toPromise();
    this.canEditSupplier = this.permissionService.canUpdate(this.Ressource);
    this.canEditProduct = this.permissionService.canUpdate('PRODUCTS');
    this.canDeleteProduct = this.permissionService.canDelete('PRODUCTS');
    this.canReadProduct = this.permissionService.canRead('PRODUCTS');
    this.canAddCategory = this.permissionService.canCreate('CATEGORIES');
    this.canAddWarehouse = this.permissionService.canCreate('WAREHOUSES');
    this.canAddSupplier = this.permissionService.canCreate('SUPPLIERS');
  }

  async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  async loadSupplier() {
    try {
      const suppliers = await firstValueFrom(this.supplierService.getSuppliers()) as Supplier[];
      this.supplier = suppliers.find((s: Supplier) => s.supplierId === this.supplierId) || null;
      if (!this.supplier) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('supplier_not_found'),
          life: 3000
        });
        this.router.navigate(['/inventory/suppliers']);
      }
    } catch (error) {
      console.error('Error loading supplier:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_supplier'),
        life: 3000
      });
      this.router.navigate(['/inventory/suppliers']);
    }
  }

  async loadSupplierProducts(): Promise<void> {
    try {
      const products = await firstValueFrom<any[]>(
        this.supplierService.getProductsBySupplier(this.supplierId)
      );
      this.supplierProducts = Array.isArray(products) ? products : [];
      this.prepareProductDistributionChart();
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_getting_supplier_products'),
        life: 3000
      });
      console.error(err);
    }
  }

  async loadSupplierPurchases(): Promise<void> {
    try {
      const purchasesResult = await firstValueFrom<any>(
        this.supplierService.getPurchasesBySupplier(this.supplierId)
      );
      this.supplierPurchases = Array.isArray(purchasesResult) ? purchasesResult : [];

      this.supplierPurchases.forEach((purchase: any) => {
        if (purchase.shop?.cashRegister?.dailyBalances) {
          delete purchase.shop.cashRegister.dailyBalances;
        }
        purchase.creationDate = new Date(purchase.creationDate);
        purchase.dateOfPurchase = new Date(purchase.dateOfPurchase);
        purchase.boeExpirationDate = new Date(purchase.boeExpirationDate);
        purchase.checkExpirationDate = new Date(purchase.checkExpirationDate);
      });

      this.prepareMonthlyPurchasesChart();
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_getting_supplier_purchases'),
        life: 3000
      });
      console.error(err);
    }
  }

  prepareMonthlyPurchasesChart(): void {
    const monthlyData = this.groupPurchasesByMonth(this.supplierPurchases);
    this.monthlyPurchasesChartData = {
      labels: Object.keys(monthlyData),
      datasets: [{
        label: this.currency,
        data: Object.values(monthlyData),
        backgroundColor: '#6366F1'
      }]
    };
  }

  prepareProductDistributionChart(): void {
    const categoryCounts = this.countProductsByCategory(this.supplierProducts);
    this.productDistributionChartData = {
      labels: Object.keys(categoryCounts),
      datasets: [{
        data: Object.values(categoryCounts),
        backgroundColor: [
          '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
          '#F97316', '#8B5CF6', '#EF4444', '#14B8A6', '#84CC16'
        ]
      }]
    };
  }

  getSupplierInitials(supplier: any): string {
    if (!supplier?.name) return '';
    const names = supplier.name.split(' ');
    return names.map((n: string) => n[0]).join('').toUpperCase();
  }

  getSupplierColor(supplier: any): string {
    const colors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];
    return colors[Math.abs(supplier.supplierId) % colors.length];
  }

  getTotalSpentWithSupplier(): number {
    return this.supplierPurchases?.reduce((sum, purchase) => sum + (purchase.totalAmount || 0), 0) || 0;
  }

  getLastPurchaseDate(): Date | null {
    if (!this.supplierPurchases?.length) return null;

    const sorted = [...this.supplierPurchases].sort((a, b) => {
      const dateA = a.dateOfPurchase ? new Date(a.dateOfPurchase).getTime() : 0;
      const dateB = b.dateOfPurchase ? new Date(b.dateOfPurchase).getTime() : 0;
      return dateB - dateA;
    });

    return sorted[0].dateOfPurchase ? new Date(sorted[0].dateOfPurchase) : null;
  }

  private groupPurchasesByMonth(purchases: any[]): { [key: string]: number } {
    return purchases.reduce((acc, purchase) => {
      const month = new Date(purchase.dateOfPurchase).toLocaleString('default', {
        month: 'short',
        year: 'numeric'
      });
      acc[month] = (acc[month] || 0) + purchase.totalAmount;
      return acc;
    }, {});
  }

  private countProductsByCategory(products: any[]): { [key: string]: number } {
    return products.reduce((acc, product) => {
      const category = product.category?.categoryName || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
  }

  editSupplier() {
    if (!this.canEditSupplier || !this.supplier) return;
    this.supplierDialogConfig = {
      visible: true,
      mode: 'edit',
      supplier: { ...this.supplier },
    };
  }

  hideDialog() {
    this.supplierDialogConfig.visible = false;
    this.submitted = false;
    // Reload supplier data after edit
    this.loadSupplier();
  }

  // Supplier Form Dialog Event Handlers
  onSupplierDialogConfigChange(config: SupplierFormDialogConfig) {
    this.supplierDialogConfig = config;
  }

  onSupplierSave(dialogData: SupplierFormDialogData) {
    this.supplier = dialogData.supplier;
    this.saveSupplier();
  }

  onSupplierCancel() {
    this.hideDialog();
  }

  onChangeCountry() {
    if (this.supplier) {
      this.supplier.city = undefined;
    }
  }


  saveSupplier() {
    this.submitted = true;
    if (this.supplier && this.supplier.name) {
      if (this.supplier.supplierId) {
        this.updateSupplier(this.supplier.supplierId, this.supplier);
      } else {
        this.addSupplier(this.supplier);
      }
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

  async updateSupplier(id: any, supplier: any): Promise<any> {
    this.supplierService.updateSupplier(id, supplier)
      .subscribe({
        next: async (response: any) => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('supplier_updated'),
            life: 3000
          });
          this.supplierDialogConfig.visible = false;
          this.submitted = false;
          await this.loadSupplier();
          await this.loadSupplierProducts();
          await this.loadSupplierPurchases();
          this.initChartOptions();
          return true;
        },
        error: (err: any) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_updating_supplier'),
            life: 3000
          });
          return false;
        },
      });
  }

  async addSupplier(data: any): Promise<any> {
    await this.supplierService.saveSupplier(data)
      .subscribe({
        next: async (response: any) => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('supplier_added'),
            life: 3000
          });
          this.supplierDialogConfig.visible = false;
          this.submitted = false;
          await this.loadSupplier();
          await this.loadSupplierProducts();
          await this.loadSupplierPurchases();
          this.initChartOptions();
          return true;
        },
        error: (err: any) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_adding_supplier'),
            life: 3000
          });
          return false;
        },
      });
  }

  contactSupplier(): void {
    if (this.supplier?.email) {
      window.location.href = `mailto:${this.supplier.email}`;
    } else if (this.supplier?.phoneNumber) {
      window.location.href = `tel:${this.supplier.phoneNumber}`;
    }
  }

  printSupplierDetails(): void {
    window.print();
  }

  refreshData(): void {
    this.loadSupplierData();
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('data_refreshed'),
      detail: this.translate.instant('supplier_data_has_been_refreshed')
    });
  }

  async loadSupplierData(): Promise<void> {
    await this.loadSupplierProducts();
    await this.loadSupplierPurchases();
    this.initChartOptions();
  }

  initChartOptions(): void {
    this.barChartOptions = {
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: number) => this.currency + value.toFixed(2)
          }
        }
      }
    };

    this.pieChartOptions = {
      plugins: {
        legend: {
          position: 'right'
        }
      }
    };
  }

  isEmptySupplier(supplier: any): boolean {
    if (!supplier) return true;

    const hasAnyField =
      supplier.email ||
      supplier.phoneNumber ||
      supplier.address ||
      supplier.city ||
      supplier.country ||
      (this.supplierProducts?.length) ||
      (this.supplierPurchases?.length);

    return !hasAnyField;
  }

  goBack(): void {
    this.location.back();
  }

  getQuantitySeverity(quantity: number): string {
    if (quantity === undefined || quantity === null) return 'info';
    if (quantity <= 0) return 'danger';
    return 'success';
  }

  getMeasureUnit(unit: string, quantity: number): string {
    if (!unit) return 'UNIT';
    const pluralizable = ['UNIT', 'PIECE', 'BOX', 'METER'];
    if (quantity > 1 && pluralizable.includes(unit)) {
      return `${unit}_plural`;
    }
    return unit;
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
    // Reload supplier products to refresh the list
    await this.loadSupplierProducts();
    // Ensure filtered products are updated
    this.filteredSupplierProducts = [...this.supplierProducts];
  }

  onProductFormSaveError(event: { product: Product, error: any }): void {
    console.error('Product form save error:', event.error);
    // Error message is already displayed by the form component
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

  async loadSupplierDetails() {
    if (!this.supplierId) return;
    try {
      const products = await firstValueFrom(this.supplierService.getProductsBySupplier(this.supplierId)) as Product[];
      this.supplierProducts = products || [];
      this.filteredSupplierProducts = [...this.supplierProducts];
      // this.updateUniqueCategories();
      // this.calculateWarehouseStats();
    } catch (error) {
      console.error('Error loading warehouse details:', error);
      this.supplierProducts = [];
      this.filteredSupplierProducts = [];
      // this.uniqueCategories = [];
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_supplier_details'),
        life: 3000
      });
      throw error; // Re-throw to let caller handle
    }
  }

  hideProductDialog(): void {
    this.productDialog = false;
    this.submitted = false;
  }

  openCategoryDialog(): void {
    this.router.navigate(['/inventory/categories']);
  }

  openWarehouseDialog(): void {
    this.router.navigate(['/inventory/warehouses']);
  }

  openSupplierDialog(): void {
    this.router.navigate(['/inventory/suppliers']);
  }
}

