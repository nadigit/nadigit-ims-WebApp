import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
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
import { getPaymentMethodIcon, getPaymentMethodSeverity, paymentMethodOptions } from 'src/app/shared/payment-utils';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { BankAccount } from 'src/app/models/bank-account';
import { BankTransaction } from 'src/app/models/bank-transaction';
import { ReconciliationValidationService, ReconciliationStatus } from 'src/app/services/reconciliation-validation.service';
import { firstValueFrom } from 'rxjs';
import { PaymentValidationService } from 'src/app/services/payment-validation.service';

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

  // Filter properties
  selectedPaymentMethod: string | null = null;
  selectedShop: Shop | null = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  
  paymentMethods: any[] = [];

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
  bankAccounts: BankAccount[] = [];
  selectedBankAccount: BankAccount | null = null;
  showBankAccountField: boolean = false;
  isBankAccountRequired: boolean = false;
  minimumAmountHint: string | null = null;

  // ⚠️ NEW: Reconciliation status properties
  reconciliationStatus: ReconciliationStatus | null = null;
  isCheckingReconciliation: boolean = false;
  expenseReconciliationCache: Map<number, ReconciliationStatus> = new Map(); // Cache reconciliation status per expense

  constructor(private messageService: MessageService,
    private expenseService: ExpenseService,
    private configService: AppConfigurationService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private shopService: ShopService,
    private bankAccountService: BankAccountService,
    private router: Router,
    private paymentValidationService: PaymentValidationService,
    private reconciliationValidationService: ReconciliationValidationService) { }

  async ngOnInit() {
    this.isLoading = true;
    this.maxExpenseDate = new Date(); // Today's date
    this.maxExpenseDate.setHours(23, 59, 59, 999); // Include entire current day
    await this.paymentValidationService.loadConfigurations();
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
    await this.loadBankAccounts();
    await this.checkPermissions();
    await this.setUserRoles();
    this.initializePaymentMethods();
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

  async editExpense(expense: Expense) {
    if (!this.canEditExpense) return;
    
    // Check reconciliation status if required
    if (expense.id && this.reconciliationValidationService.requiresReconciliation(expense.paymentMethod)) {
      try {
        this.isCheckingReconciliation = true;
        const status = await this.reconciliationValidationService.checkExpenseReconciliationStatus(expense.id);
        this.expenseReconciliationCache.set(expense.id, status);
        this.isCheckingReconciliation = false;
        
        if (!status.canProceed) {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('cannot_edit_delete_expense_reconciliation_required'),
            life: 5000
          });
          return; // Don't open edit dialog
        }
      } catch (error) {
        console.error('Error checking reconciliation status:', error);
        this.isCheckingReconciliation = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_reconciliation_status'),
          life: 4000
        });
        // On error, allow user to proceed - backend will validate
      }
    }
    
    this.expense = { ...expense };
    // Restore selected bank account if expense has bankAccountId
    if (expense.bankAccountId) {
      this.selectedBankAccount = this.bankAccounts.find(acc => acc.accountId === expense.bankAccountId) || null;
    }
    await this.updateBankAccountFieldVisibility();
    this.expenseDialog = true;
  }

  async updateBankAccountFieldVisibility() {
    if (!this.expense.paymentMethod) {
      this.showBankAccountField = false;
      this.isBankAccountRequired = false;
      this.minimumAmountHint = null;
      return;
    }

    this.showBankAccountField = await this.paymentValidationService.shouldShowBankAccountField(this.expense.paymentMethod);
    this.isBankAccountRequired = await this.paymentValidationService.isBankAccountRequired(this.expense.paymentMethod);
    this.minimumAmountHint = await this.paymentValidationService.getMinimumAmountHint(this.expense.paymentMethod, this.currency);

    // Pre-populate bank account from shop's default if available
    if (this.showBankAccountField && this.expense.shop && !this.selectedBankAccount) {
      const shopDefaultAccountId = this.expense.shop.defaultBankAccount?.accountId || this.expense.shop.defaultBankAccountId;
      if (shopDefaultAccountId) {
        const defaultAccount = this.bankAccounts.find(acc => acc.accountId === shopDefaultAccountId);
        if (defaultAccount) {
          this.selectedBankAccount = defaultAccount;
          this.expense.bankAccountId = defaultAccount.accountId;
        }
      }
    }
  }

  async onShopChange() {
    // When shop changes, update bank account field visibility and pre-populate if needed
    await this.updateBankAccountFieldVisibility();
  }

  async onPaymentMethodChange() {
    // When payment method changes, update bank account field visibility and pre-populate if needed
    await this.updateBankAccountFieldVisibility();
  }

  async deleteExpense(expense: Expense) {
    if (!this.canDeleteExpense) return;
    
    // Check reconciliation status if required
    if (expense.id && this.reconciliationValidationService.requiresReconciliation(expense.paymentMethod)) {
      try {
        this.isCheckingReconciliation = true;
        const status = await this.reconciliationValidationService.checkExpenseReconciliationStatus(expense.id);
        this.expenseReconciliationCache.set(expense.id, status);
        this.isCheckingReconciliation = false;
        
        if (!status.canProceed) {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('cannot_edit_delete_expense_reconciliation_required'),
            life: 5000
          });
          return; // Don't open delete dialog
        }
      } catch (error) {
        console.error('Error checking reconciliation status:', error);
        this.isCheckingReconciliation = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_reconciliation_status'),
          life: 4000
        });
        // On error, allow user to proceed - backend will validate
      }
    }
    
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

  async openNew() {
    if (!this.canAddExpense) return;
    this.expense = {};
    this.selectedBankAccount = null;
    this.expense.dateOfExpense = new Date();
    this.expense.paymentMethod = 'Cash';
    this.submitted = false;
    this.showBankAccountField = false;
    if (this.expense.paymentMethod === 'Bank' || this.expense.paymentMethod === 'Check' || this.expense.paymentMethod === 'BOE') {
      this.showBankAccountField = true;
    }
    this.expenseDialog = true;
  }

  isExpenseFinalized(expense: any): boolean {
    const today = new Date();
    const dateOfExpense = new Date(expense.dateOfExpense);
    return dateOfExpense.toDateString() === today.toDateString();
  }

  // ⚠️ NEW: Helper methods for template
  requiresReconciliation(paymentMethod: string | null | undefined): boolean {
    return this.reconciliationValidationService.requiresReconciliation(paymentMethod);
  }

  canEditExpenseBasedOnReconciliation(expense: Expense): boolean {
    if (!expense.id || !this.requiresReconciliation(expense.paymentMethod)) {
      return true; // No reconciliation required or new expense
    }
    
    const status = this.expenseReconciliationCache.get(expense.id);
    return !status || status.canProceed;
  }

  canDeleteExpenseBasedOnReconciliation(expense: Expense): boolean {
    if (!expense.id || !this.requiresReconciliation(expense.paymentMethod)) {
      return true; // No reconciliation required
    }
    
    const status = this.expenseReconciliationCache.get(expense.id);
    return !status || status.canProceed;
  }

  async saveExpense() {
    this.submitted = true;

    if (!this.expense.paymentMethod) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    // Validate bank account and minimum amount using validation service
    const validation = await this.paymentValidationService.validateBankPayment(
      this.expense.paymentMethod || '',
      this.selectedBankAccount?.accountId,
      this.expense.amount,
      'expense'
    );

    if (!validation.valid) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: validation.error || this.translate.instant('validation_error')
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

      let savedExpense: Expense | null = null;
      if (this.expense.id) {
        savedExpense = await this.updateExpense(this.expense.id, this.expense);
      } else {
        savedExpense = await this.addExpense(this.expense);
      }

      // 🔹 Record bank transaction if payment method requires it
      const requiresBankAccount =
        savedExpense &&
        savedExpense.paymentMethod &&
        ['BANK_TRANSFER', 'CHECK', 'BOE'].includes(savedExpense.paymentMethod);

      if (requiresBankAccount && this.selectedBankAccount && savedExpense) {
        await this.recordBankTransaction(savedExpense);
      }

      this.expenses = [...this.expenses];
      this.expenseDialog = false;
      this.expense = {};
      this.selectedBankAccount = null;
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

  @ViewChild('dt') dt!: Table;

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (this.dt) {
      this.dt.filterGlobal(value, 'contains');
    }
  }

  private initializePaymentMethods() {
    // Payment methods for expenses (same as payments)
    this.paymentMethods = paymentMethodOptions.map(opt => ({
      label: opt.label,
      value: opt.value
    }));
  }

  onFilterChange() {
    // Apply filters to the table
    if (this.dt) {
      const filters: any = {};
      
      if (this.selectedPaymentMethod) {
        filters['paymentMethod'] = { value: this.selectedPaymentMethod, matchMode: 'equals' };
      }
      
      if (this.selectedShop) {
        // Filter by shop.shopName
        filters['shop.shopName'] = { value: this.selectedShop.shopName, matchMode: 'equals' };
      }
      
      if (this.startDate || this.endDate) {
        if (this.startDate && this.endDate) {
          // Date range filter
          filters['dateOfExpense'] = { value: [this.startDate, this.endDate], matchMode: 'dateBetween' };
        } else if (this.startDate) {
          filters['dateOfExpense'] = { value: this.startDate, matchMode: 'dateIs' };
        } else if (this.endDate) {
          filters['dateOfExpense'] = { value: this.endDate, matchMode: 'dateIs' };
        }
      }
      
      this.dt.filters = filters;
      this.dt.filteredValue = null; // Trigger filtering
    }
  }

  clearFilters() {
    this.selectedPaymentMethod = null;
    this.selectedShop = null;
    this.startDate = null;
    this.endDate = null;
    
    if (this.dt) {
      this.dt.filters = {};
      this.dt.filteredValue = null;
    }
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
    // Find the expense to check its payment method
    const expenseToDelete = this.expenses.find(e => e.id === id);
    
    // Check reconciliation status before deleting (refresh to ensure it's current)
    if (expenseToDelete && this.reconciliationValidationService.requiresReconciliation(expenseToDelete.paymentMethod)) {
      try {
        const status = await this.reconciliationValidationService.checkExpenseReconciliationStatus(id);
        if (!status.canProceed) {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('cannot_edit_delete_expense_reconciliation_required'),
            life: 5000
          });
          return; // Don't delete
        }
      } catch (error) {
        console.error('Error checking reconciliation status:', error);
        // On error, proceed with delete - backend will validate
      }
    }
    
    await this.expenseService.deleteExpense(id)
      .subscribe({
        next: (response: any) => {
          // Clear cache for this expense
          this.expenseReconciliationCache.delete(id);
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
          
          // Handle reconciliation validation error from backend
          const errorMessage = err?.error?.message || err?.message || '';
          const errorLower = errorMessage.toLowerCase();
          
          // Check for reconciliation-related errors
          if (errorLower.includes('reconciled') || 
              errorLower.includes('reconciliation') || 
              errorLower.includes('bank transaction')) {
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: this.translate.instant('cannot_edit_delete_expense_reconciliation_required'),
              life: 5000
            });
          } else {
            // Generic error message
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant('error'),
              detail: this.translateService.instant('error_deleting_expense'),
              life: 3000
            });
          }
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

  async loadBankAccounts() {
    try {
      const accounts$ = await this.bankAccountService.getBankAccounts(true);
      this.bankAccounts = await firstValueFrom(accounts$);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  }

  async updateExpense(id: any, expense: any): Promise<Expense | null> {
    return new Promise((resolve) => {
      // Check reconciliation status before updating (refresh to ensure it's current)
      if (this.reconciliationValidationService.requiresReconciliation(expense.paymentMethod)) {
        this.reconciliationValidationService.checkExpenseReconciliationStatus(id)
          .then(status => {
            if (!status.canProceed) {
              this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('warning'),
                detail: this.translate.instant('cannot_edit_delete_expense_reconciliation_required'),
                life: 5000
              });
              resolve(null);
              return;
            }
            // Proceed with update
            this.performUpdateExpense(id, expense, resolve);
          })
          .catch(error => {
            console.error('Error checking reconciliation status:', error);
            // On error, proceed with update - backend will validate
            this.performUpdateExpense(id, expense, resolve);
          });
      } else {
        // No reconciliation required, proceed with update
        this.performUpdateExpense(id, expense, resolve);
      }
    });
  }

  private performUpdateExpense(id: any, expense: any, resolve: Function) {
    this.expenseService.updateExpense(id, expense)
      .subscribe({
        next: (response: Expense) => {
          // Clear cache for this expense
          this.expenseReconciliationCache.delete(id);
          this.onGetAllExpenses();
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('successful'),
            detail: this.translateService.instant('expense_updated'),
            life: 3000
          });
          resolve(response);
        },
        error: (err: any) => {
          console.error(err);
          
          // Handle reconciliation validation error from backend
          const errorMessage = err?.error?.message || err?.message || '';
          const errorLower = errorMessage.toLowerCase();
          
          // Check for reconciliation-related errors
          if (errorLower.includes('reconciled') || 
              errorLower.includes('reconciliation') || 
              errorLower.includes('bank transaction')) {
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: this.translate.instant('cannot_edit_delete_expense_reconciliation_required'),
              life: 5000
            });
          } else {
            // Generic error message
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant('error'),
              detail: this.translateService.instant('error_updating_expense'),
              life: 3000
            });
          }
          
          resolve(null);
        },
      });
  }

  async addExpense(data: any): Promise<Expense | null> {
    return new Promise((resolve) => {
      this.expenseService.saveExpense(data)
        .subscribe({
          next: (response: Expense) => {
            this.onGetAllExpenses();
            this.messageService.add({
              severity: 'success',
              summary: this.translateService.instant('successful'),
              detail: this.translateService.instant('expense_added'),
              life: 3000
            });
            resolve(response);
          },
          error: (err: any) => {
            console.error(err);
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant('error'),
              detail: this.translateService.instant('error_adding_expense'),
              life: 3000
            });
            resolve(null);
          },
        });
    });
  }

  async recordBankTransaction(expense: Expense) {
    if (!this.selectedBankAccount || !expense.id) return;

    try {
      // Format date to ISO string (YYYY-MM-DD)
      const formatDateToString = (date: string | Date | undefined): string => {
        if (!date) return new Date().toISOString().split('T')[0];
        if (typeof date === 'string') return date.split('T')[0];
        const d = date as Date;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const transaction: BankTransaction = {
        account: this.selectedBankAccount,
        type: 'PAYMENT',
        amount: expense.amount || 0,
        transactionDate: formatDateToString(expense.dateOfExpense),
        description: `Expense: ${expense.purpose || 'N/A'}`,
        reference: `EXP-${expense.id}`,
        checkNumber: expense.checkNumber,
        expense: { id: expense.id },
        reconciled: false
      };

      const transaction$ = await this.bankAccountService.recordTransaction(
        this.selectedBankAccount.accountId!,
        transaction
      );
      await firstValueFrom(transaction$);
    } catch (error) {
      console.error('Error recording bank transaction:', error);
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('payment_saved_but_bank_transaction_failed'),
        life: 5000,
      });
    }
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
    if (!expense || !expense.id) return;
    this.router.navigate(['/finance/expenses', expense.id]);
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

}
