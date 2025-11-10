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
import { getPaymentMethodIcon, getPaymentMethodSeverity } from 'src/app/shared/payment-utils';

@Component({
  templateUrl: './expenses.component.html',
  styleUrls: ['../finance.component.css', './expenses.component.css'],
  providers: [MessageService]
})
export class ExpensesComponent implements OnInit {

  Ressource: string = 'EXPENSES';

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
  canReadExpense: boolean = false;
  isLoading: boolean = true;
  userRoles: any;
  isAdmin: boolean = false;
  maxExpenseDate: any;
  expenseDetailsDialog: boolean = false;
  selectedExpense: any = null;
  expenseEvents: any[] = [];
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
    this.isLoading = true;
    this.maxExpenseDate = new Date(); // Today's date
    this.maxExpenseDate.setHours(23, 59, 59, 999); // Include entire current day
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
    this.canReadExpense = this.permissionService.canRead(this.Ressource);
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
    this.selectedExpenses = [];
  }

  async confirmDelete() {
    this.deleteExpenseDialog = false;
    await this.onDeleteExpense(this.expense.id);
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
    this.expense.paymentMethod = 'Cash';
    this.submitted = false;
    this.expenseDialog = true;
  }

  isExpenseFinalized(expense: any): boolean {
    const today = new Date();
    const dateOfExpense = new Date(expense.dateOfExpense);
    return dateOfExpense.toDateString() === today.toDateString();
  }

  saveExpense() {
    this.submitted = true;

    if (!this.expense.paymentMethod) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    if (
      this.expense.paymentMethod === 'Check' &&
      (!this.expense.checkNumber || !this.expense.checkExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('check_fields_required')
      });
      return;
    }

    if (
      this.expense.paymentMethod === 'BOE' &&
      (!this.expense.boeNumber || !this.expense.boeExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('boe_fields_required')
      });
      return;
    }

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
        this.updateExpense(this.expense.id, this.expense)
      } else {
        this.addExpense(this.expense)
      }
      this.expenses = [...this.expenses];
      this.expenseDialog = false;
      this.expense = {};
    }
    else {
      this.messageService.add({
        severity: 'error',
        summary: this.translateService.instant('error'),
        detail: this.translateService.instant('please_fill_required_fields'),
        life: 3000
      });
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
        complete: () => {
          this.isLoading = false;
        }
      })
  }

  async onDeleteExpense(id: any) {
    await this.expenseService.deleteExpense(id)
      .subscribe({
        next: (response: any) => {
          this.onGetAllExpenses();
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('successful'),
            detail: this.translateService.instant('expense_deleted'),
            life: 3000
          });
        },
        error: (err: any) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('error'),
            detail: this.translateService.instant('error_deleting_expense'),
            life: 3000
          });
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
          summary: this.translateService.instant('error'),
          detail: this.translateService.instant('error_getting_shops'),
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
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('successful'),
            detail: this.translateService.instant('expense_updated'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('error'),
            detail: this.translateService.instant('error_updating_expense'),
            life: 3000
          });
          return false;
        },
      })
  }

  async addExpense(data: any): Promise<any> {
    await this.expenseService.saveExpense(data)
      .subscribe({
        next: (response: any) => {
          this.onGetAllExpenses();
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('successful'),
            detail: this.translateService.instant('expense_added'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('error'),
            detail: this.translateService.instant('error_adding_expense'),
            life: 3000
          });
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
    this.reportingService.exportExcel(modifiedExpenses, 'expenses');
  }

  showExpenseDetails(expense: any) {
    this.selectedExpense = expense;
    this.expenseDetailsDialog = true;
    this.generateExpenseEvents();
  }

  hideExpenseDetailsDialog() {
    this.expenseDetailsDialog = false;
    this.selectedExpense = null;
  }

  generateExpenseEvents() {
    this.expenseEvents = [
      {
        status: 'Recorded',
        date: this.selectedExpense?.creationDate,
        icon: 'pi pi-plus-circle',
        button: 'Submit for Approval'
      },
      {
        status: 'Pending',
        date: this.selectedExpense?.submissionDate,
        icon: 'pi pi-clock',
        button: 'Approve Expense'
      },
      {
        status: 'Approved',
        date: this.selectedExpense?.approvalDate,
        icon: 'pi pi-check-circle',
        button: 'Mark as Reimbursed'
      },
      {
        status: 'Reimbursed',
        date: this.selectedExpense?.reimbursementDate,
        icon: 'pi pi-flag-fill',
        button: null
      }
    ].filter(event => event.date != null || event.status === 'Recorded');
  }

  // Status methods
  getExpenseStatusSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'Recorded': 'info',
      'Pending': 'warning',
      'Approved': 'success',
      'Reimbursed': 'help',
      'Rejected': 'danger'
    };
    return severityMap[status] || 'info';
  }

  getExpenseStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'Recorded': 'pi pi-plus-circle',
      'Pending': 'pi pi-clock',
      'Approved': 'pi pi-check-circle',
      'Reimbursed': 'pi pi-flag-fill',
      'Rejected': 'pi pi-times-circle'
    };
    return iconMap[status] || 'pi pi-question-circle';
  }

  getExpenseActionButtonIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'Recorded': 'pi pi-arrow-right',
      'Pending': 'pi pi-check',
      'Approved': 'pi pi-dollar',
      'Reimbursed': 'pi pi-flag'
    };
    return iconMap[status] || 'pi pi-arrow-right';
  }

  getExpenseActionButtonSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'Recorded': 'primary',
      'Pending': 'warning',
      'Approved': 'success',
      'Reimbursed': 'help'
    };
    return severityMap[status] || 'primary';
  }

  isExpenseEventActive(event: any): boolean {
    const statusOrder = ['Recorded', 'Pending', 'Approved', 'Reimbursed'];
    const currentStatusIndex = statusOrder.indexOf(this.selectedExpense?.status);
    const eventStatusIndex = statusOrder.indexOf(event.status);
    return eventStatusIndex <= currentStatusIndex;
  }

  showExpenseEventButton(event: any): boolean {
    const statusOrder = ['Recorded', 'Pending', 'Approved', 'Reimbursed'];
    const currentStatusIndex = statusOrder.indexOf(this.selectedExpense?.status);
    const eventStatusIndex = statusOrder.indexOf(event.status);

    return eventStatusIndex === currentStatusIndex && event.button !== null;
  }

  getExpenseStatusDescription(status: string): string {
    const descriptions: { [key: string]: string } = {
      'Recorded': this.translate.instant('expense_status_recorded_description'),
      'Pending': this.translate.instant('expense_status_pending_description'),
      'Approved': this.translate.instant('expense_status_approved_description'),
      'Reimbursed': this.translate.instant('expense_status_reimbursed_description'),
      'Rejected': this.translate.instant('expense_status_rejected_description')
    };
    return descriptions[status] || this.translate.instant('status_description_not_available');
  }

  // Quick action methods
  printExpenseReceipt(expense: any) {
    console.log('Print expense receipt:', expense);
  }

  exportExpenseToPDF(expense: any) {
    console.log('Export expense to PDF:', expense);
  }

  uploadReceipt(expense: any) {
    console.log('Upload receipt for expense:', expense);
  }

  duplicateExpense(expense: any) {
    console.log('Duplicate expense:', expense);
  }

  previewReceipt(receiptUrl: string) {
    // Implement receipt preview functionality
    window.open(receiptUrl, '_blank');
  }

  getPaymentMethodSeverity(method: string): string {
    return getPaymentMethodSeverity(method);
  }

  getPaymentMethodIcon(method: string): string {
    return getPaymentMethodIcon(method);
  }

  hasExpensePaymentMethodDetails(): boolean {
    return !!(this.selectedExpense?.checkNumber || this.selectedExpense?.boeNumber ||
      this.selectedExpense?.checkExpirationDate ||
      this.selectedExpense?.boeExpirationDate);
  }
}
