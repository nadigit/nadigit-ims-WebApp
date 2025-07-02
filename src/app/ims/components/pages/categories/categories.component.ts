import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { Category } from 'src/app/models/category';
import { Product } from 'src/app/models/product';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { CategoryService } from 'src/app/services/category.service';
import { PermissionService } from 'src/app/services/permission.service';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';

@Component({
  templateUrl: './categories.component.html',
  styleUrls: ['../pages.component.css', './categories.component.css'],
  providers: [MessageService]
})
export class CategoriesComponent implements OnInit {

  Ressource: string = "CATEGORIES"

  categoryDialog: boolean = false;

  lowStockThreshold;

  categoryProductsDialog: boolean = false;

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

  isLoading = true;
  currency: string = '';

  constructor(private messageService: MessageService,
    private categoryService: CategoryService,
    private reportingService: ReportingService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,) { }

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
    this.canListProducts = this.permissionService.canListProducts(this.Ressource)
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
  }

  async openCategoryProductsDialog(category: Category) {
    this.category = category;
    console.log(this.lowStockThreshold)
    await this.onGetCategoryProducts();
    this.categoryProductsDialog = true;
  }

  hideCategoryProductsDialog() {
    this.category = {};
    this.categoryProductsDialog = false;
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

  async onGetCategoryProducts() {
    await this.categoryService.getCategoryProducts(this.category.categoryId)
      .subscribe({
        next: (response: any) => {
          this.products = response;
        },
        error: (err: any) => {
          this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('error_getting_products'), life: 3000 })
          console.log(err)
        }
      })
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

}
