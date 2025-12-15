import { Component, OnInit } from '@angular/core';
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
import { UploadEvent } from 'src/app/models/uploadEvent';
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

@Component({
  templateUrl: './categories.component.html',
  styleUrls: ['../inventory.component.css', './categories.component.css'],
  providers: [MessageService]
})
export class CategoriesComponent implements OnInit {

  Ressource: string = "CATEGORIES"

  categoryDialog: boolean = false;

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

  costingMethods: any[] = [];

  // Permissions
  canAddCategory: boolean = false;
  canEditCategory: boolean = false;
  canDeleteCategory: boolean = false;
  canListProducts: boolean = false;
  canAddProduct: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canReadProduct: boolean = false;
  isAdmin: boolean = false;
  measureUnits: any[] = [];
  attributeTypes: any[] = [];
  deleteProductDialog: boolean = false;
  isLoading = true;
  currency: string = '';
  selectedProduct: Product;
  productDetailDialog: boolean = false;
  productDialog: boolean = false;
  userRoles: any;
  suppliers: Supplier[] = [];
  warehouses: Warehouse[] = [];
  imageURL: any;
  uploadedFile: File | null = null;
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
    private router: Router) {
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
    this.costingMethods = [
      { label: this.translate.instant('costing_method_fifo'), value: 'FIFO' },
      { label: this.translate.instant('costing_method_lifo'), value: 'LIFO' },
      { label: this.translate.instant('costing_method_weighted_average'), value: 'WEIGHTED_AVERAGE' },
      { label: this.translate.instant('costing_method_standard_cost'), value: 'STANDARD_COST' },
      { label: this.translate.instant('costing_method_none'), value: 'NONE' }
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
    this.category = { ...category };
    this.categoryDialog = true;
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
    this.categoryDialog = false;
    this.submitted = false;
  }

  openNew() {
    if (!this.canAddCategory) return;
    this.category = {};
    this.submitted = false;
    this.categoryDialog = true;
    this.category.costingMethod = 'NONE';
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
      this.categoryDialog = false;
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

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
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

  exportPdf() {
    this.reportingService.exportPdf(this.exportColumns, this.categories, 'categories')
  }

  exportExcel() {
    // Clone the suppliers array to avoid modifying the original array
    const modifiedCategories = this.categories.map(category => {
      // Create a copy of the supplier object to modify
      const modifiedCategory = { ...category };

      // Remove the column you want to exclude
      delete modifiedCategory.creationDate;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedSupplier['columnToRemove'];

      return modifiedCategory;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedCategories, 'categories');
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
    this.selectedProduct = product;
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.onGetAllSuppliers();
    this.productDialog = true;
  }

  addAttribute() {
    if (!this.selectedProduct.attributes) {
      this.selectedProduct.attributes = [];
    }

    this.selectedProduct.attributes.push({
      attributeName: '',
      attributeType: 'STRING', // default type
      value: ''
    });
  }

  removeAttribute(index: number) {
    if (this.selectedProduct.attributes && this.selectedProduct.attributes.length > index) {
      this.selectedProduct.attributes.splice(index, 1);
    }
  }

  editImage() {
    this.selectedProduct.productImage = null;
    this.uploadedFile = null;
  }

  async saveProduct() {
    this.submitted = true;

    if (
      this.selectedProduct.name &&
      this.selectedProduct.reference &&
      this.selectedProduct.quantityAvailable &&
      this.selectedProduct.buyingPrice &&
      this.selectedProduct.sellingPrice &&
      this.selectedProduct.category &&
      this.selectedProduct.supplier
    ) {
      if (this.isAdmin && !this.selectedProduct.warehouse) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('warehouse_required'),
          life: 3000,
        });
        return;
      }

      // 🔍 Check for duplicate product with same reference in the same warehouse
      const isDuplicate = this.products.some((p: any) =>
        p.reference === this.selectedProduct.reference &&
        p.warehouse?.warehouseId === this.selectedProduct.warehouse?.warehouseId &&
        p.productId !== this.selectedProduct.productId // exclude current product if updating
      );

      if (isDuplicate) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('product_already_exists_in_warehouse'),
          life: 4000,
        });
        return;
      }

      // 📦 Upload product image if any
      if (this.uploadedFile) {
        const filePath = `images/${this.uploadedFile.name}`;
        const fileRef = this.storage.ref(filePath);
        const task = this.storage.upload(filePath, this.uploadedFile);

        try {
          await lastValueFrom(task.snapshotChanges());
          const url = await lastValueFrom(fileRef.getDownloadURL());
          this.selectedProduct.productImage = url;
          this.uploadedFile = null;
        } catch (error) {
          console.error('Error uploading file:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_uploading_image'),
            life: 3000,
          });
          return;
        }
      }

      // Clean attributes before saving
      if (this.selectedProduct.attributes && this.selectedProduct.attributes.length > 0) {
        this.selectedProduct.attributes.forEach(attr => {
          // strip transient field if it still exists
          delete attr.value;

          // optionally normalize booleans (Angular checkboxes can send null)
          if (attr.attributeType === 'BOOLEAN' && attr.booleanValue == null) {
            attr.booleanValue = false;
          }
        });
      }

      // ✏️ Update or add product
      if (this.selectedProduct.productId) {
        this.updateProduct(this.selectedProduct.productId, this.selectedProduct)
          ? this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_updated'),
            life: 3000,
          })
          : this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_product'),
            life: 3000,
          });
      }

      // ✅ Reset and close dialog
      this.productDialog = false;
      // this.selectedProduct = {};
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3100,
      });
      return;
    }
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

  async onFileUpload(event: UploadEvent): Promise<void> {
    console.log("in upload");
    const file = event.files[0];

    // Save the file temporarily and update the imageURL
    this.imageURL = URL.createObjectURL(file);

    // Store the actual file for later use
    this.uploadedFile = file;

    // Note: The actual upload to Firebase Storage will happen when the user clicks "Save" in the saveProduct method
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

}
