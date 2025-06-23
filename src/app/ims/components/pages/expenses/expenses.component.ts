import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { ExpenseService } from 'src/app/services/expense.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Expense } from 'src/app/models/expense';
import { Shop } from 'src/app/models/shop';
import { ShopService } from 'src/app/services/shop.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';

@Component({
  templateUrl: './expenses.component.html',
  styleUrls: ['../pages.component.css'],
  providers: [MessageService]
})
export class ExpensesComponent implements OnInit {

  Ressource : string = 'EXPENSES';

  expenseDialog: boolean = false;

  deleteExpenseDialog: boolean = false;

  deleteExpensesDialog: boolean = false;

  expenses: Expense[] = [];

  expense: Expense = {};

  shops: Shop[] = [];

  shop: Shop = {};

  selectedExpenses: Expense[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  exportColumns!: ExportColumn[];
  currency: string = '';

  canAddExpense: boolean = false;
  canEditExpense: boolean = false;
  canDeleteExpense: boolean = false;
  isLoading: boolean = true;
  userRoles: any;
  isAdmin: boolean = false;
  constructor(private messageService: MessageService,
    private expenseService: ExpenseService,
    private configService: AppConfigurationService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private shopService: ShopService) { }
    
  async ngOnInit() {
    this.isLoading=true;
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.onGetAllExpenses();
    this.onGetAllShops();
    await this.checkPermissions();
    await this.setUserRoles();
    this.cols = [
      { field: 'id', header: this.translateService.instant('ID') },
      { field: 'purpose', header: this.translateService.instant('expense_purpose') },
      { field: 'dateOfExpense', header: this.translateService.instant('expense_date') },
      { field: 'amount', header: this.translateService.instant('expense_amount') },
      { field: 'shop', header: this.translateService.instant('shop') },
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddExpense = this.permissionService.canCreate(this.Ressource);
    this.canEditExpense = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteExpense = this.permissionService.canDelete(this.Ressource);

  }

  deleteSelectedExpenses() {
    if (!this.canDeleteExpense) return;
    this.deleteExpensesDialog = true;
  }

  editExpense(expense: Expense) {
    if (!this.canEditExpense) return;
    this.expense = { ...expense };
    this.expenseDialog = true;
  }

  deleteExpense(expense: Expense) {
    if (!this.canDeleteExpense) return;
    this.deleteExpenseDialog = true;
    this.expense = { ...expense };
  }

  confirmDeleteSelected() {
    this.deleteExpensesDialog = false;
    this.selectedExpenses.forEach(selectedExpense => this.onDeleteExpense(selectedExpense.id));
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Expenses Deleted', life: 3000 });
    this.selectedExpenses = [];
  }

  async confirmDelete() {
    this.deleteExpenseDialog = false;
    await this.onDeleteExpense(this.expense.id);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Expense Deleted', life: 3000 });
    this.expense = {};
  }

  hideDialog() {
    this.expenseDialog = false;
    this.submitted = false;
  }

  openNew() {
    if (!this.canAddExpense) return;
    this.expense = {};
    this.expense.dateOfExpense = new Date();
    this.submitted = false;
    this.expenseDialog = true;
  }

  saveExpense() {
    this.submitted = true;
    if (this.expense.dateOfExpense) {
      // Ensure `dateOfExpense` is a Date object
      const date =
        typeof this.expense.dateOfExpense === "string"
          ? new Date(this.expense.dateOfExpense)
          : this.expense.dateOfExpense;
  
      // Format the date into YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
      const day = String(date.getDate()).padStart(2, "0");
  
      this.expense.dateOfExpense = `${year}-${month}-${day}`; // Convert to string format
    }
    if (this.expense.checkExpirationDate) {
      // Ensure `dateOfExpense` is a Date object
      const date =
        typeof this.expense.checkExpirationDate === "string"
          ? new Date(this.expense.checkExpirationDate)
          : this.expense.checkExpirationDate;
  
      // Format the date into YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
      const day = String(date.getDate()).padStart(2, "0");
  
      this.expense.checkExpirationDate = `${year}-${month}-${day}`; // Convert to string format
    } 
    else if (this.expense.boeExpirationDate) {
      // Ensure `dateOfExpense` is a Date object
      const date =
        typeof this.expense.boeExpirationDate === "string"
          ? new Date(this.expense.boeExpirationDate)
          : this.expense.boeExpirationDate;
  
      // Format the date into YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
      const day = String(date.getDate()).padStart(2, "0");
  
      this.expense.boeExpirationDate = `${year}-${month}-${day}`; // Convert to string format
    }
    if (this.expense.purpose) {
      console.log(this.expense)

      if (this.expense.id) {
        this.updateExpense(this.expense.id, this.expense) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Expense updated with success', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating expense', life: 3000 })
      } else {
        this.addExpense(this.expense) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Expense created with success', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding expense', life: 3000 }))
      }
      this.expenses = [...this.expenses];
      this.expenseDialog = false;
      this.expense = {};
    }
    else{
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out the required fields', life: 3000 });
      return;
    }
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }


  clear(table: Table) {
    table.clear();
  }

  async onGetAllExpenses() {
    await this.expenseService.getExpenses()
      .subscribe({
        next: (response: any) => {
          this.expenses = response;
          this.expenses.forEach((expense: any) => {
            expense.creationDate = new Date(<Date>expense.creationDate)
            expense.dateOfExpense = new Date(<Date>expense.dateOfExpense)
            expense.checkExpirationDate = new Date(<Date>expense.checkExpirationDate)
            expense.boeExpirationDate = new Date(<Date>expense.boeExpirationDate)
          });
        },
        error: (err: any) => {
          console.error(err)
        },
        complete: () =>{
          this.isLoading=false;
        }
      })
  }

  async onDeleteExpense(id: any) {
    await this.expenseService.deleteExpense(id)
      .subscribe({
        next: (response: any) => {
          this.onGetAllExpenses();
        },
        error(err: any) {
          console.error(err)
        },
      })
  }

  async onGetAllShops() {
    await this.shopService.getShops().subscribe({
      next: (response: any) => {
        this.shops = response;
        console.log(this.shops);
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error while getting shops',
          life: 3000,
        });
        console.log(err);
      },
    });
  }

  async updateExpense(id: any, expense: any): Promise<any> {
    console.log(expense)
    await this.expenseService.updateExpense(id, expense)
      .subscribe({
        next: (response: any) => {
          this.onGetAllExpenses();
          return true;
        },
        error(err: any) {
          console.error(err);
          return false;
        },
      })
  }

  async addExpense(data: any): Promise<any> {
    await this.expenseService.saveExpense(data)
      .subscribe({
        next: (response: any) => {
          this.onGetAllExpenses();
          return true;
        },
        error(err: any) {
          console.error(err);
          return false;
        },
      })
  }

  exportPdf() {
    this.reportingService.exportPdf(this.exportColumns, this.expenses, 'expenses')
  }

  exportExcel() {
    // Clone the expenses array to avoid modifying the original array
    const modifiedExpenses = this.expenses.map(expense => {
      // Create a copy of the expense object to modify
      const modifiedExpense = { ...expense };

      // Remove the column you want to exclude
      delete modifiedExpense.creationDate;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedExpense['columnToRemove'];

      return modifiedExpense;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedExpenses,'expenses');
  }

}
