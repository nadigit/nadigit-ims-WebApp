import { Component, EventEmitter, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Category } from 'src/app/models/category';
import { CategoryService } from 'src/app/services/category.service';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';

@Component({
  templateUrl: './categories.component.html',
  providers: [MessageService]
})
export class CategoriesComponent implements OnInit {

  categoryDialog: boolean = false;

  deleteCategoryDialog: boolean = false;

  deleteCategoriesDialog: boolean = false;

  categories: Category[] = [];

  category: Category = {};

  selectedCategories: Category[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  exportColumns!: ExportColumn[];

  constructor(private messageService: MessageService, 
    private categoryService: CategoryService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService) { }

  ngOnInit() {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.onGetAllCategories();

    this.cols = [
      { field: 'categoryId', header: 'Name' },
      { field: 'categoryName', header: 'Name' },
      { field: 'description', header: 'Description' }
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

  }

  deleteSelectedCategories() {
    this.deleteCategoriesDialog = true;
  }

  editCategory(category: Category) {
    this.category = { ...category };
    this.categoryDialog = true;
  }

  deleteCategory(category: Category) {
    this.deleteCategoryDialog = true;
    this.category = { ...category };
  }

  async confirmDeleteSelected() {
    this.deleteCategoriesDialog = false;
    await this.selectedCategories.forEach(selectedCategory => this.onDeleteCategory(selectedCategory.categoryId));
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Users Deleted', life: 3000 });
    this.selectedCategories = [];
  }

  async confirmDelete() {
    this.deleteCategoryDialog = false;
    await this.onDeleteCategory(this.category.categoryId);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'User Deleted', life: 3000 });
    this.category = {};
  }

  hideDialog() {
    this.categoryDialog = false;
    this.submitted = false;
  }

  openNew() {
    this.category = {};
    this.submitted = false;
    this.categoryDialog = true;
  }

  saveCategory() {
    this.submitted = true;
    console.log(this.category)
    if (this.category.categoryName) {
      if (this.category.categoryId) {
        this.updateCategory(this.category.categoryId, this.category) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Category Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating category', life: 3000 })
      } else {
        this.addCategory(this.category) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Category created', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new category', life: 3000 }))
      }
      this.categories = [...this.categories];
      this.categoryDialog = false;
      this.category = {};
    }
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }
 

  clear(table: Table) {
    table.clear();
  }

  getSeverity(status: any) {
    switch (status) {
      case false:
        return 'danger';

      case true:
        return 'success';

      case 'new':
        return 'info';

      case 'negotiation':
        return 'warning';

      case 'renewal':
        return null;

      default:
        return '';
    }
  }

  async onGetAllCategories() {
    await this.categoryService.getCategories()
      .subscribe({
        next: (response: any) => {
          this.categories = response;
          this.categories.forEach((category: any) => (category.creationDate = new Date(<Date>category.creationDate)));
          console.log(this.categories);
        },
        error: (err: any) => {
          console.log(err)
        }
      })
  }

  async onDeleteCategory(id: any) {
    await this.categoryService.deleteCategory(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllCategories();
        },
        error(err: any) {
          console.log(err)
        },
      })
  }


  async updateCategory(id: any, category: any): Promise<any> {
    console.log(category)
    await this.categoryService.updateCategory(id, category)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllCategories();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  async addCategory(data: any): Promise<any> {
    await this.categoryService.saveCategory(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllCategories();
          return true;
        },
        error(err: any) {
          console.log(err);
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
