import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { Category } from 'src/app/models/category';
import { Product } from 'src/app/models/product';
import { Supplier } from 'src/app/models/supplier';
import { Warehouse } from 'src/app/models/warehouse';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { CategoryService } from 'src/app/services/category.service';
import { PermissionService } from 'src/app/services/permission.service';
import { ProductService } from 'src/app/services/product.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { TranslationService } from 'src/app/services/translation.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { getMeasureUnit } from 'src/app/shared/product-utils';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { CategoryFormDialogComponent, CategoryFormDialogConfig, CategoryFormDialogData } from './category-form-dialog/category-form-dialog.component';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';

@Component({
  templateUrl: './categories.component.html',
  styleUrls: ['../inventory.component.css', './categories.component.css'],
  providers: [MessageService]
})
export class CategoriesComponent implements OnInit {

  Ressource: string = "CATEGORIES"

  // Dialog configuration for reusable component
  categoryDialogConfig: CategoryFormDialogConfig = {
    visible: false,
    mode: 'edit',
    category: {},
    isLoading: false
  };

  lowStockThreshold;

  deleteCategoryDialog: boolean = false;

  deleteCategoriesDialog: boolean = false;

  categories: Category[] = [];

  products: Product[] = [];

  category: Category = {};

  selectedCategories: Category[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  exportColumns!: ExportColumn[];

  // Permissions
  canAddCategory: boolean = false;
  canEditCategory: boolean = false;
  canDeleteCategory: boolean = false;
  canListProducts: boolean = false;
  canAddProduct: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canReadProduct: boolean = false;
  canAddSupplier: boolean = false;
  canAddWarehouse: boolean = false;
  isAdmin: boolean = false;
  measureUnits: any[] = [];
  attributeTypes: any[] = [];
  deleteProductDialog: boolean = false;
  isLoading = true;
  isExporting: boolean = false;
  exportProgress: string = '';
  currency: string = '';
  selectedProduct: Product;
  productDetailDialog: boolean = false;
  productDialog: boolean = false;
  userRoles: any;
  suppliers: Supplier[] = [];
  warehouses: Warehouse[] = [];
  archiveProductDialog: boolean = false;
  constructor(private messageService: MessageService,
    private categoryService: CategoryService,
    private productService: ProductService,
    private supplierService: SupplierService,
    private warehouseService: WarehouseService,
    private storage: AngularFireStorage,
    private reportingService: ReportingService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private router: Router,
    private organizationService: OrganizationService) {
    this.setUserRoles();
    this.measureUnits = [
      { value: 'UNIT', label: this.translate.instant('UNIT') },
      { value: 'KG', label: this.translate.instant('KG') },
      { value: 'LITER', label: this.translate.instant('LITER') },
      { value: 'PIECE', label: this.translate.instant('PIECE') },
      { value: 'BOX', label: this.translate.instant('BOX') },
      { value: 'METER', label: this.translate.instant('METER') }
    ];
    this.attributeTypes = [
      { label: this.translate.instant('String'), value: 'STRING' },
      { label: this.translate.instant('Integer'), value: 'INTEGER' },
      { label: this.translate.instant('Double'), value: 'DOUBLE' },
      { label: this.translate.instant('Boolean'), value: 'BOOLEAN' }
    ];
  }

  async ngOnInit() {
    this.isLoading = true;
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });

    this.lowStockThreshold = await this.getLowStockThreshold();

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    await this.checkPermissions();
    this.onGetAllCategories();

    this.cols = [
      { field: 'categoryId', header: this.translateService.instant('category_id') },
      { field: 'categoryName', header: this.translateService.instant('category_name') },
      { field: 'description', header: this.translateService.instant('category_description') }
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));


  }

  deleteSelectedCategories() {
    if (!this.canDeleteCategory) return;
    this.deleteCategoriesDialog = true;
  }

  editCategory(category: Category) {
    if (!this.canEditCategory) return;
    this.categoryDialogConfig = {
      visible: true,
      mode: 'edit',
      category: { ...category },
      isLoading: false
    };
  }

  deleteCategory(category: Category) {
    if (!this.canDeleteCategory) return;
    this.deleteCategoryDialog = true;
    this.category = { ...category };
  }

  async confirmDeleteSelected() {
    this.deleteCategoriesDialog = false;
    let hasError = false;

    for (const selectedCategory of this.selectedCategories) {
      try {
        await this.onDeleteCategory(selectedCategory.categoryId);
      } catch (error) {
        hasError = true;
        console.error('Error deleting category:', error);
      }
    }

    if (!hasError) {
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('categories_deleted'),
        life: 3000
      });
    }

    this.selectedCategories = [];
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canAddCategory = this.permissionService.canCreate(this.Ressource);
    this.canEditCategory = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteCategory = this.permissionService.canDelete(this.Ressource);
    this.canListProducts = this.permissionService.canListProducts(this.Ressource);
    this.canAddProduct = this.permissionService.canCreate('PRODUCTS');
    this.canEditProduct = this.permissionService.canUpdate('PRODUCTS');
    this.canDeleteProduct = this.permissionService.canDelete('PRODUCTS');
    this.canReadProduct = this.permissionService.canRead('PRODUCTS');
    this.canAddSupplier = this.permissionService.canCreate('SUPPLIERS');
    this.canAddWarehouse = this.permissionService.canCreate('WAREHOUSES');
  }

  async confirmDelete() {
    this.deleteCategoryDialog = false;
    try {
      await this.onDeleteCategory(this.category.categoryId);
      this.category = {};
    } catch (error) {
      console.error('Error deleting category:', error);
    }
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

  openNew() {
    if (!this.canAddCategory) return;
    this.categoryDialogConfig = {
      visible: true,
      mode: 'create',
      category: { costingMethod: 'NONE' },
      isLoading: false
    };
    this.submitted = false;
  }

  openCategoryDetails(category: Category): void {
    this.router.navigate(['/inventory/categories', category.categoryId]);
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
      } else {
        try {
          await this.addCategory(this.category);
        } catch (error) {
          console.error('Error adding category:', error);
        }
      }
      this.categories = [...this.categories];
      this.categoryDialogConfig.visible = false;
      this.category = {};
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

  @ViewChild('dt') dt!: Table;

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (this.dt) {
      this.dt.filterGlobal(value, 'contains');
    }
  }

  async onGetAllCategories() {
    await this.categoryService.getCategories()
      .subscribe({
        next: (response: any) => {
          this.categories = response;
          this.categories.forEach((category: any) => (category.creationDate = new Date(<Date>category.creationDate)));
        },
        error: (err: any) => {
          this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('error_getting_categories'), life: 3000 })
          console.log(err)
        },
        complete: () => {
          this.isLoading = false;
        }
      })
  }

  async onGetCategoryProducts(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.categoryService.getCategoryProducts(this.category.categoryId)
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

  async onDeleteCategory(id: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.categoryService.deleteCategory(id)
        .subscribe({
          next: (response: any) => {
            this.onGetAllCategories();
            this.messageService.add({
              severity: 'success',
              summary: this.translate.instant('successful'),
              detail: this.translate.instant('category_deleted'),
              life: 3000
            });
            resolve();
          },
          error: (err: any) => {
            this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('error_deleting_category'), life: 3000 });
            console.log(err);
            reject(err);
          }
        });
    });
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

  async addCategory(data: any): Promise<any> {
    await this.categoryService.saveCategory(data)
      .subscribe({
        next: (response: any) => {
          this.onGetAllCategories();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('category_created'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          console.log(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_adding_category'),
            life: 3000
          });
          return false;
        },
      });
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

      // Get filtered categories from table (or all if no filter applied)
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      const filteredCategories = this.dt?.filteredValue || this.categories || [];
      
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
      // Map column field names to translation keys
      const translationKeyMap: { [key: string]: string } = {
        'categoryId': 'ID',
        'categoryName': 'category_name',
        'description': 'category_description'
      };
      
      const translatedExportColumns: ExportColumn[] = this.cols
        .filter((col) => col.field !== 'categoryId') // Exclude ID column
        .map((col) => {
          const translationKey = translationKeyMap[col.field] || col.field;
          return {
            title: this.translate.instant(translationKey),
            dataKey: col.field
          };
        });
      
      // Get translated title for PDF
      const pdfTitle = this.translate.instant('categories_menu_title');
      
      // Export with translated headers and title
      this.reportingService.exportPdf(translatedExportColumns, filteredCategories, 'categories', pdfTitle);
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${filteredCategories.length} records exported.`,
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

      // Get filtered categories from table (or all if no filter applied)
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      const filteredCategories = this.dt?.filteredValue || this.categories || [];
      
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
        'categoryId': 'ID',
        'categoryName': 'category_name',
        'description': 'category_description'
      };
      
      // Clone the categories array to avoid modifying the original array
      const modifiedCategories = filteredCategories.map(category => {
        // Create a copy of the category object to modify
        const modifiedCategory = { ...category };

        // Remove the column you want to exclude
        delete modifiedCategory.creationDate;

        return modifiedCategory;
      });

      // Create a translated version of the data with translated headers
      // For Excel, we need to create objects with translated keys
      const translatedCategories = modifiedCategories.map(category => {
        const translated: any = {};
        this.cols.forEach(col => {
          // Exclude ID and creationDate columns
          if (col.field !== 'creationDate' && col.field !== 'categoryId') {
            const translationKey = translationKeyMap[col.field] || col.field;
            const translatedHeader = this.translate.instant(translationKey);
            translated[translatedHeader] = category[col.field as keyof Category];
          }
        });
        return translated;
      });

      // Now, export the translated array to Excel
      this.reportingService.exportExcel(translatedCategories, 'categories');
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${translatedCategories.length} records exported.`,
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

  getInStockCount(): number {
    return this.products?.filter(p => p.quantityAvailable > this.lowStockThreshold)?.length || 0;
  }

  getLowStockCount(): number {
    return this.products?.filter(p => p.quantityAvailable > 0 && p.quantityAvailable <= this.lowStockThreshold)?.length || 0;
  }

  getOutOfStockCount(): number {
    return this.products?.filter(p => p.quantityAvailable <= 0)?.length || 0;
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
    this.selectedProduct = { ...product }; // Create a copy to avoid modifying the original
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.onGetAllSuppliers();
    this.productDialog = true;
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
          await this.onGetCategoryProducts();
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

  async updateProduct(id: any, product: any): Promise<any> {
    console.log(product)
    await this.productService.saveProduct(product)
      .subscribe({
        next: async (response: any) => {
          console.log(response);
          await this.onGetCategoryProducts();
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_product'),
            life: 3000
          });
          console.log(err);
          return false;
        },
      })
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
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

  // Product Form Component Event Handlers
  onProductSaveSuccess(product: Product): void {
    console.log('Product saved successfully:', product);
    this.productDialog = false;
    this.selectedProduct = {};
    // Refresh the category products if we're in a category context
    if (this.category && this.category.categoryId) {
      this.onGetCategoryProducts();
    }
  }

  onProductSaveError(error: any): void {
    console.error('Product save error:', error);
    // The error handling is done in the product form component
  }

  onProductCancel(): void {
    console.log('Product form cancelled');
    this.productDialog = false;
    this.selectedProduct = {};
  }

  onCategoryAdd(): void {
    // Handle category add dialog if needed
    console.log('Category add requested');
  }

  onSupplierAdd(): void {
    // Handle supplier add dialog if needed
    console.log('Supplier add requested');
  }

  onWarehouseAdd(): void {
    // Handle warehouse add dialog if needed
    console.log('Warehouse add requested');
  }

}
