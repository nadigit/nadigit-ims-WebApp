import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Category } from 'src/app/models/category';
import { Product } from 'src/app/models/product';
import { CategoryService } from 'src/app/services/category.service';
import { PermissionService } from 'src/app/services/permission.service';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';

@Component({
  templateUrl: './categories.component.html',
  styleUrls: ['../pages.component.css'],
  providers: [MessageService]
})
export class CategoriesComponent implements OnInit {

  Ressource: string = "CATEGORIES"

  categoryDialog: boolean = false;

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
  canListProducts:boolean = false;

  isLoading = true;

  constructor(private messageService: MessageService, 
    private categoryService: CategoryService,
    private reportingService: ReportingService,
    public keycloakService: KeycloakService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,) { }

  async ngOnInit() {
    this.isLoading =true;
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
    await this.selectedCategories.forEach(selectedCategory => this.onDeleteCategory(selectedCategory.categoryId));
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Categories Deleted', life: 3000 });
    this.selectedCategories = [];
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddCategory = this.permissionService.canCreate(this.Ressource);
    this.canEditCategory = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteCategory = this.permissionService.canDelete(this.Ressource);
    this.canListProducts = this.permissionService.canListProducts(this.Ressource)
  }

  async confirmDelete() {
    this.deleteCategoryDialog = false;
    await this.onDeleteCategory(this.category.categoryId);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Category Deleted', life: 3000 });
    this.category = {};
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

  async openCategoryProductsDialog(category: Category){
    this.category = category;
    await this.onGetCategoryProducts();
    this.categoryProductsDialog = true;
  }

  hideCategoryProductsDialog(){
    this.category = {};
    this.categoryProductsDialog = false;
  }

  saveCategory() {
    this.submitted = true;
    if (this.category.categoryName) {
      if (this.category.categoryId) {
        this.updateCategory(this.category.categoryId, this.category) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Category Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating category', life: 3000 })
      } else {
        this.addCategory(this.category) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Category created', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new category', life: 3000 }))
      }
      this.categories = [...this.categories];
      this.categoryDialog = false;
      this.category = {};
    } else{
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out the required fields', life: 3000 });
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
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting categories', life: 3000 })
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
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting products', life: 3000 })
          console.log(err)
        }
      })
  }

  async onDeleteCategory(id: any) {
    await this.categoryService.deleteCategory(id)
      .subscribe({
        next: (response: any) => {
          this.onGetAllCategories();
        },
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while deleting category', life: 3000 })
          console.log(err)
        },
      })
  }


  async updateCategory(id: any, category: any): Promise<any> {
    await this.categoryService.updateCategory(id, category)
      .subscribe({
        next: (response: any) => {
          this.onGetAllCategories();
          return true;
        },
        error(err: any) {
          console.log(err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating category', life: 3000 })
          return false;
        },
      })
  }

  async addCategory(data: any): Promise<any> {
    await this.categoryService.saveCategory(data)
      .subscribe({
        next: (response: any) => {
          this.onGetAllCategories();
          return true;
        },
        error(err: any) {
          console.log(err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new category', life: 3000 })
          return false;
        },
      })
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
    this.reportingService.exportExcel(modifiedCategories,'categories');
  }

}
