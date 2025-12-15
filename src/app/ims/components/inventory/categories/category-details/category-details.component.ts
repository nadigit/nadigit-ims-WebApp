import { Component, OnInit } from '@angular/core';
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
import { firstValueFrom } from 'rxjs';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { getMeasureUnit } from 'src/app/shared/product-utils';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { lastValueFrom } from 'rxjs';
import { UploadEvent } from 'src/app/models/uploadEvent';

@Component({
  templateUrl: './category-details.component.html',
  styleUrls: ['./category-details.component.css', '../../inventory.component.css'],
  providers: [MessageService]
})
export class CategoryDetailsComponent implements OnInit {
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
  imageURL: any;
  uploadedFile: File | null = null;
  deleteProductDialog: boolean = false;
  archiveProductDialog: boolean = false;
  submitted: boolean = false;
  measureUnits: any[] = [];
  attributeTypes: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
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
  ) {
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
      }
    });

    this.lowStockThreshold = await this.getLowStockThreshold();

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.categoryId = +params['id'];
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadCategory();
      await this.loadCategoryDetails();
      this.isLoading = false;
    });
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

  removeImage() {
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

      // Check for duplicate product with same reference in the same warehouse
      const isDuplicate = this.products.some((p: any) =>
        p.reference === this.selectedProduct.reference &&
        p.warehouse?.warehouseId === this.selectedProduct.warehouse?.warehouseId &&
        p.productId !== this.selectedProduct.productId
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

      // Upload product image if any
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
          delete attr.value;
          if (attr.attributeType === 'BOOLEAN' && attr.booleanValue == null) {
            attr.booleanValue = false;
          }
        });
      }

      // Update or add product
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

      this.productDialog = false;
      await this.loadCategoryDetails();
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

  async updateProduct(id: any, product: any): Promise<any> {
    console.log(product)
    await this.productService.saveProduct(product)
      .subscribe({
        next: async (response: any) => {
          console.log(response);
          await this.loadCategoryDetails();
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

  async onFileUpload(event: UploadEvent): Promise<void> {
    console.log("in upload");
    const file = event.files[0];

    // Save the file temporarily and update the imageURL
    this.imageURL = URL.createObjectURL(file);

    // Store the actual file for later use
    this.uploadedFile = file;
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
    this.router.navigate(['/inventory/categories']);
  }
}

