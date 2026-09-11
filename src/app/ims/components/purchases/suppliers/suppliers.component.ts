import { Component, EventEmitter, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService, PrimeNGConfig } from 'primeng/api';
import { Table } from 'primeng/table';
import { Supplier } from 'src/app/models/supplier';
import { Country, State } from 'country-state-city';
import { SupplierService } from 'src/app/services/supplier.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom, lastValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LocationService } from 'src/app/services/location.service';
import { Product } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';
import { Category } from 'src/app/models/category';
import { Warehouse } from 'src/app/models/warehouse';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { CategoryService } from 'src/app/services/category.service';
import { UploadEvent } from 'src/app/models/uploadEvent';
import { getPaymentMethodLabel, getPaymentMethodSeverity } from 'src/app/shared/payment-utils';
import { BRAND_CHART_PALETTE_EXTENDED, BRAND_COLORS } from 'src/app/utils/brand-colors';
import { Purchase } from 'src/app/models/purchase';
import { SupplierFormDialogComponent, SupplierFormDialogConfig, SupplierFormDialogData } from './supplier-form-dialog/supplier-form-dialog.component';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

@Component({
  templateUrl: './suppliers.component.html',
  styleUrls: ['./suppliers.component.css', '../purchases.component.css'],
  providers: [MessageService]
})
export class SuppliersComponent implements OnInit {

  Ressource: string = 'SUPPLIERS';

  // Dialog configuration for reusable component
  supplierDialogConfig: SupplierFormDialogConfig = {
    visible: false,
    mode: 'edit',
    supplier: {},
  };

  deleteSupplierDialog: boolean = false;

  deleteSuppliersDialog: boolean = false;

  supplierDetailsDialog: boolean = false;

  suppliers: Supplier[] = [];

  supplier: Supplier = {};

  selectedSuppliers: Supplier[] = [];

  supplierProducts: Product[] = [];

  supplierPurchases: Purchase[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  currency: any = '';

  rowsPerPageOptions = [20, 50, 100];
  pageSize = 20;

  valSwitch: boolean = false;

  countries: any;

  selectedCountry: any = null;

  states: any = null;

  exportColumns!: ExportColumn[];

  lowStockThreshold;

  private readonly destroy$ = new Subject<void>();
  
  isExporting: boolean = false;
  exportProgress: string = '';

  // imageURL and uploadedFile removed - now handled by ProductFormComponent

  monthlyPurchasesChartData: any;
  productDistributionChartData: any;
  barChartOptions: any;
  pieChartOptions: any;

  canAddSupplier: boolean = false;
  canEditSupplier: boolean = false;
  canDeleteSupplier: boolean = false;
  canReadSupplier: boolean = false;
  canAddProduct: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canReadProduct: boolean = false;
  canAddCategory: boolean = false;
  canAddWarehouse: boolean = false;

  isLoading: boolean = true;
  selectedProduct: Product;
  productDetailDialog: boolean = false;
  productDialog: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  categories: Category[] = [];
  warehouses: Warehouse[] = [];
  // measureUnits and attributeTypes removed - now handled by ProductFormComponent
  deleteProductDialog: boolean = false;

  archiveProductDialog: boolean = false;

  constructor(private messageService: MessageService,
    private supplierService: SupplierService,
    private reportingService: ReportingService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private warehouseService: WarehouseService,
    private translate: TranslateService,
    private locationService: LocationService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private configService: AppConfigurationService,
    public keycloakService: KeycloakService,
    private router: Router,
    private organizationService: OrganizationService,
    private route: ActivatedRoute,
    public pageSizeService: TablePageSizeService) {
    this.setUserRoles();
    // measureUnits and attributeTypes initialization removed - now handled by ProductFormComponent
  }

  async ngOnInit() {
    this.isLoading = true;
    this.pageSize = this.pageSizeService.initState(TablePageSizeKeys.suppliers, this.rowsPerPageOptions, {
      pageSize: this.pageSize,
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.countries = this.locationService.getAllCountriesWithTranslation();
    });
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });

    this.lowStockThreshold = await this.getLowStockThreshold();

    this.onGetAllSuppliers();
    await this.checkPermissions();
    this.cols = [
      { field: 'supplierId', header: this.translateService.instant('ID') },
      { field: 'name', header: this.translateService.instant('supplier_name') },
      { field: 'email', header: this.translateService.instant('supplier_email') },
      { field: 'phoneNumber', header: this.translateService.instant('supplier_phone_number') },
      { field: 'country', header: this.translateService.instant('supplier_country') },
      { field: 'city', header: this.translateService.instant('supplier_city') },
      { field: 'address', header: this.translateService.instant('supplier_address') },
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));


    this.applyCreateFromQuery();
  }

  /**
   * Deep-link hand-off: ?newSupplier=1 opens the creation dialog straight away, so a "New" shortcut
   * from the dashboard (or NadiPilot) lands the user in the form rather than on the list. Deferred
   * so permissions and reference data finish loading first; openNew() enforces the permission.
   */
  private applyCreateFromQuery(): void {
    if (!this.route?.snapshot?.queryParamMap?.get('newSupplier')) {
      return;
    }
    // Consume the trigger straight away (replacing history, not adding to it) so a refresh or a
    // Back into this page doesn't silently reopen the dialog.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { newSupplier: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    setTimeout(() => {
      try {
        this.openNew();
      } catch {
        // best-effort; the user is already on the suppliers screen
      }
    }, 600);
  }


  onTablePage(event: any): void {
    this.pageSizeService.applyPageEvent(TablePageSizeKeys.suppliers, this.rowsPerPageOptions, event, this);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddSupplier = this.permissionService.canCreate(this.Ressource);
    this.canEditSupplier = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteSupplier = this.permissionService.canDelete(this.Ressource);
    this.canReadSupplier = this.permissionService.canRead(this.Ressource);

    this.canAddProduct = this.permissionService.canCreate('PRODUCTS');
    this.canEditProduct = this.permissionService.canUpdate('PRODUCTS');
    this.canDeleteProduct = this.permissionService.canDelete('PRODUCTS');
    this.canReadProduct = this.permissionService.canRead('PRODUCTS');
    
    this.canAddCategory = this.permissionService.canCreate('CATEGORIES');
    this.canAddSupplier = this.permissionService.canCreate('SUPPLIERS');
    this.canAddWarehouse = this.permissionService.canCreate('WAREHOUSES');
  }

  deleteSelectedSuppliers() {
    if (!this.canDeleteSupplier) return;
    this.deleteSuppliersDialog = true;
  }

  editSupplier(supplier: Supplier) {
    if (!this.canEditSupplier) return;
    this.supplierDialogConfig = {
      visible: true,
      mode: 'edit',
      supplier: { ...supplier },
    };
    this.supplier = { ...supplier };
    this.onSelectedCountry(this.supplier.country)
  }

  deleteSupplier(supplier: Supplier) {
    if (!this.canDeleteSupplier) return;
    this.deleteSupplierDialog = true;
    this.supplier = { ...supplier };
  }

  confirmDeleteSelected(force: boolean = false) {
    this.deleteSuppliersDialog = false;
    this.selectedSuppliers.forEach(selectedSupplier => this.onDeleteSupplier(selectedSupplier.supplierId, force));
    this.selectedSuppliers = [];
  }

  async confirmDelete(supplierId?: number, force: boolean = false) {
    this.deleteSupplierDialog = false;
    await this.onDeleteSupplier(supplierId ?? this.supplier.supplierId, force);
    this.supplier = {};
  }

  hideDialog() {
    this.supplierDialogConfig.visible = false;
    this.submitted = false;
    this.selectedCountry = {};
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

  openNew() {
    if (!this.canAddSupplier) return;
    this.supplierDialogConfig = {
      visible: true,
      mode: 'create',
      supplier: {},
    };
    this.supplier = {};
    this.submitted = false;
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

  openSupplierDetails(supplier: any): void {
    this.router.navigate(['/purchases/suppliers', supplier.supplierId]);
  }


  async loadSupplierProducts(): Promise<void> {
    try {
      const products = await firstValueFrom<any[]>(
        this.supplierService.getProductsBySupplier(this.supplier.supplierId)
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
        this.supplierService.getPurchasesBySupplier(this.supplier.supplierId)
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
        backgroundColor: BRAND_COLORS.saas
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
          ...BRAND_CHART_PALETTE_EXTENDED,
          '#F97316', '#EF4444', '#84CC16'
        ]
      }]
    };
  }

  hideProductDialog() {
    this.productDialog = false;
    this.submitted = false;
  }

  async onProductFormSaveSuccess(productData: Product): Promise<void> {
    console.log('Product form saved successfully:', productData);
    // Reload supplier products to reflect changes
    await this.loadSupplierProducts();
    this.productDialog = false;
    this.selectedProduct = {};
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
    // Since we're already in suppliers, we could open the supplier form dialog
    // For now, just navigate to suppliers page
    this.router.navigate(['/inventory/suppliers']);
  }

  openWarehouseDialog(): void {
    // Navigate to warehouses page or open warehouse dialog
    this.router.navigate(['/inventory/warehouses']);
  }

  getSupplierInitials(supplier: any): string {
    if (!supplier?.name) return '';
    const names = supplier.name.split(' ');
    return names.map((n: string) => n[0]).join('').toUpperCase();
  }

  getSupplierColor(supplier: any): string {
    // Generate a consistent color based on supplier ID
    const colors = [...BRAND_CHART_PALETTE_EXTENDED];
    return colors[Math.abs(supplier.supplierId) % colors.length];
  }

  getPaymentMethodSeverity(method: string): string {
    return getPaymentMethodSeverity(method);
  }

  getTotalSpentWithSupplier(): number {
    return this.supplierPurchases?.reduce((sum, purchase) => sum + (purchase.totalAmount || 0), 0) || 0;
  }

  getLastPurchaseDate(): Date | null {
    if (!this.supplierPurchases?.length) return null;

    const sorted = [...this.supplierPurchases].sort((a, b) => {
      const dateA = a.dateOfPurchase ? new Date(a.dateOfPurchase).getTime() : 0;
      const dateB = b.dateOfPurchase ? new Date(b.dateOfPurchase).getTime() : 0;
      return dateB - dateA; // descending order
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

  viewPurchaseDetails(purchase: any): void {
    // Implement purchase details view
  }

  createNewPurchase(): void {
    // Implement new purchase creation
  }

  contactSupplier(): void {
    if (this.supplier.email) {
      window.location.href = `mailto:${this.supplier.email}`;
    } else if (this.supplier.phoneNumber) {
      window.location.href = `tel:${this.supplier.phoneNumber}`;
    }
  }

  printSupplierDetails(): void {
    window.print();
  }

  exportToExcel(): void {
    // Implement Excel export
  }

  saveSupplier() {
    this.submitted = true;
    if (this.supplier.name) {
      if (this.supplier.supplierId) {
        this.updateSupplier(this.supplier.supplierId, this.supplier);
      } else {
        this.addSupplier(this.supplier);
      }
      this.suppliers = [...this.suppliers];
    this.supplierDialogConfig.visible = false;
    this.supplier = {};
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

  initChartOptions(): void {
    console.log('intializing charts ...')
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

  @ViewChild('dt') dt!: Table;

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (this.dt) {
      this.dt.filterGlobal(value, 'contains');
    }
  }


  clear(table: Table) {
    table.clear();
  }

  async onGetAllSuppliers() {
    await this.supplierService.getSuppliers()
      .subscribe({
        next: (response: any) => {
          this.suppliers = response;
          this.suppliers.forEach((supplier: any) => (supplier.creationDate = new Date(<Date>supplier.creationDate)));
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
        complete: () => {
          this.isLoading = false;
        }
      })
  }

  async onDeleteSupplier(id: any, force: boolean = false) {
    this.supplierService.deleteSupplier(id, force).subscribe({
      next: (response: any) => {
        this.onGetAllSuppliers();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('supplier_deleted'),
          life: 3000,
        });
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_deleting_supplier'),
          life: 3000,
        });
      },
    });
  }


  async updateSupplier(id: any, supplier: any): Promise<any> {
    console.log(supplier)
    this.supplierService.updateSupplier(id, supplier)
      .subscribe({
        next: (response: any) => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('supplier_updated'),
            life: 3000
          });
          this.onGetAllSuppliers();
          return true;
        },
        error(err: any) {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_updating_supplier'),
            life: 3000
          });
          return false;
        },
      })
  }

  async addSupplier(data: any): Promise<any> {
    await this.supplierService.saveSupplier(data)
      .subscribe({
        next: (response: any) => {
          this.onGetAllSuppliers();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('supplier_added'),
            life: 3000
          });
          return true;
        },
        error(err: any) {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_adding_supplier'),
            life: 3000
          });
          return false;
        },
      })
  }

  onChangeCountry() {
    this.supplier.city = undefined;
  }

  onSelectedCountry(event) {
    if ((this.supplier.country != this.selectedCountry) && (this.supplier.city == undefined)) this.supplier.city = undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    this.states = this.locationService.getStatesByCountryCode(this.selectedCountry.isoCode);

  }

  async exportPdf() {
    if (this.isExporting) {
      return; // Prevent multiple simultaneous exports
    }

    const previousUiLang = this.translate.currentLang;
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

      // Get filtered suppliers from table (or all if no filter applied)
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      const filteredSuppliers = this.dt?.filteredValue || this.suppliers || [];
      
      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';
      
      // Load token and get organization's default locale
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      // Build translated export columns based on organization's default locale
      const translationKeyMap: { [key: string]: string } = {
        'name': 'supplier_name',
        'email': 'supplier_email',
        'phoneNumber': 'supplier_phone_number',
        'country': 'supplier_country',
        'city': 'supplier_city',
        'address': 'supplier_address'
      };
      
      const translatedExportColumns: ExportColumn[] = this.exportColumns
        .filter((col) => col.dataKey !== 'supplierId') // Exclude ID column
        .map((col) => {
          const translationKey = translationKeyMap[col.dataKey] || col.dataKey;
          return {
            title: this.translate.instant(translationKey),
            dataKey: col.dataKey
          };
        });
      
      // Get translated title for PDF
      const pdfTitle = this.translate.instant('suppliers_menu_title') || this.translate.instant('suppliers');
      
      // Export with translated headers and title
      this.reportingService.exportPdf(translatedExportColumns, filteredSuppliers, 'suppliers', pdfTitle, organization?.organizationName);
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${filteredSuppliers.length} records exported.`,
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
      // Restored here as well as on the happy path: an export that throws left the whole
      // console in the organization language until the next reload.
      if (previousUiLang && this.translate.currentLang !== previousUiLang) {
        this.translate.use(previousUiLang);
      }

      this.isExporting = false;
      this.exportProgress = '';
    }
  }

  async exportExcel() {
    if (this.isExporting) {
      return; // Prevent multiple simultaneous exports
    }

    const previousUiLang = this.translate.currentLang;
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

      // Get filtered suppliers from table (or all if no filter applied)
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      const filteredSuppliers = this.dt?.filteredValue || this.suppliers || [];
      
      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';
      
      // Load token and get organization's default locale
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      // Map column field names to translation keys
      const translationKeyMap: { [key: string]: string } = {
        'name': 'supplier_name',
        'email': 'supplier_email',
        'phoneNumber': 'supplier_phone_number',
        'country': 'supplier_country',
        'city': 'supplier_city',
        'address': 'supplier_address'
      };
      
      // Clone the suppliers array to avoid modifying the original array
      const modifiedSuppliers = filteredSuppliers.map(supplier => {
        const modifiedSupplier: any = { ...supplier };

        // Remove columns to exclude
        delete modifiedSupplier.creationDate;
        delete modifiedSupplier.supplierId;

        return modifiedSupplier;
      });

      // Create a translated version of the data with translated headers
      const translatedSuppliers = modifiedSuppliers.map(supplier => {
        const translated: any = {};
        this.cols.forEach(col => {
          // Exclude creationDate and ID columns
          if (col.field !== 'creationDate' && col.field !== 'supplierId') {
            const translationKey = translationKeyMap[col.field] || col.field;
            const translatedHeader = this.translate.instant(translationKey);
            translated[translatedHeader] = supplier[col.field as keyof Supplier];
          }
        });
        return translated;
      });

      // Now, export the translated array to Excel
      this.reportingService.exportExcel(translatedSuppliers, 'suppliers', {
        title: this.translate.instant('suppliers_menu_title'),
        organizationName: organization?.organizationName,
        generatedLabel: this.translate.instant('export_generated_on'),
        generatedAt: new Date().toLocaleString(defaultLocale),
      });
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${filteredSuppliers.length} records exported.`,
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
      // Restored here as well as on the happy path: an export that throws left the whole
      // console in the organization language until the next reload.
      if (previousUiLang && this.translate.currentLang !== previousUiLang) {
        this.translate.use(previousUiLang);
      }

      this.isExporting = false;
      this.exportProgress = '';
    }
  }

  getMeasureUnit(unit: string, quantity: number): string {
    if (!unit) return 'UNIT'; // fallback

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
    this.selectedProduct = { ...product };
    // Ensure supplier is set from the current supplier context
    if (!this.selectedProduct.supplier && this.supplier) {
      this.selectedProduct.supplier = this.supplier;
    }
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    // Ensure suppliers array includes current supplier for the dropdown
    if (this.supplier && this.supplier.supplierId) {
      const supplierExists = this.suppliers.some(s => s.supplierId === this.supplier.supplierId);
      if (!supplierExists) {
        this.suppliers = [...this.suppliers, this.supplier];
      }
    }
    this.productDialog = true;
  }

  deleteProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.selectedProduct = { ...product };
    this.deleteProductDialog = true;
  }

  async onProductDeleteConfirmed(productId: number) {
    if (!this.canDeleteProduct) return;
    await this.onDeleteProduct(productId);
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
          await this.loadSupplierProducts();
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

  // updateProduct method removed - now handled by ProductFormComponent

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  async onGetAllCategories() {
    await this.categoryService.getCategories().subscribe({
      next: async (response: any) => {
        this.categories = response;

        // Create category parent node
        const categoryNode = {
          label: await this.translateService.instant('Categories'), // Ensure this matches your filter logic
          icon: 'pi pi-fw pi-tag',
          children: this.categories.map((category) => ({
            label: category.categoryName,
            data: category,
            parent: { label: this.translateService.instant('Categories') }, // Add parent reference
          })),
        };
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

        // Create warehouse parent node
        const warehouseNode = {
          label: this.translateService.instant('Warehouses'), // Ensure this matches your filter logic
          icon: 'pi pi-fw pi-database',
          children: this.warehouses.map((warehouse) => ({
            label: warehouse.name,
            data: warehouse,
            parent: { label: this.translateService.instant('Warehouses') }, // Add parent reference
          })),
        };
        console.log(this.warehouses);
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

  // onFileUpload method removed - now handled by ProductFormComponent

  getPaymentMethodLabel(paymentMethod: string) {
    return getPaymentMethodLabel(paymentMethod);
  }

  calculateProfit(product: Product): number {
    if (!product.sellingPrice || !product.buyingPrice) return 0;
    return (product.sellingPrice - product.buyingPrice) / product.buyingPrice;
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
          this.loadSupplierProducts();
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

  refreshData(): void {
    this.loadSupplierData();
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('data_refreshed'),
      detail: this.translate.instant('supplier_data_has_been_refreshed')
    });
  }

  async loadSupplierData(): Promise<void> {
    // Load orders, returns, payments for customer
    await this.loadSupplierProducts();
    await this.loadSupplierPurchases();
    this.initChartOptions();
  }

}
