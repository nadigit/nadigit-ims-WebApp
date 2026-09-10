import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService, LazyLoadEvent } from 'primeng/api';
import { Table } from 'primeng/table';
import { ExpenseService, buildExpenseWritePayload } from 'src/app/services/expense.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Expense, ExpenseStatus } from 'src/app/models/expense';
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
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { DatePipe } from '@angular/common';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import {
  canDeleteExpenseByWorkflowStatus as expenseWorkflowAllowsDelete,
  canEditExpenseByWorkflowStatus as expenseWorkflowAllowsEdit
} from 'src/app/shared/expense-workflow-utils';
import {
  initTablePageSizeState,
  persistTablePageSizeFromLazyEvent,
  TablePageSizeKeys,
} from 'src/app/utils/table-page-size.storage';

interface LazyLoadEventExt extends LazyLoadEvent {
  globalFilter?: string;
  filters?: { [field: string]: any };
}

@Component({
  templateUrl: './expenses.component.html',
  styleUrls: ['../finance.component.css', './expenses.component.css'],
  providers: [MessageService, DatePipe]
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
  /** null = all statuses */
  selectedExpenseStatus: ExpenseStatus | null = null;
  startDate: Date | null = null;
  endDate: Date | null = null;

  requireApproval: boolean = false;
  expenseConfigLoaded: boolean = false;
  userShopId: number | null = null;
  totalAmountFiltered: number | null = null;

  approveExpenseDialog: boolean = false;
  rejectExpenseDialog: boolean = false;
  expensePendingAction: Expense | null = null;
  rejectionReason: string = '';
  isApprovalActionLoading: boolean = false;
  
  paymentMethods: any[] = [];
  
  // Lazy loading properties
  totalRecords: number = 0;
  globalFilter: string = '';
  lastLazyLoadEvent: LazyLoadEventExt = {
    first: 0,
    rows: 20,
    sortField: 'dateOfExpense',
    sortOrder: -1
  };
  private isInitialLoad: boolean = true;
  private lazyLoadCallCount: number = 0;
  
  isExporting: boolean = false;
  exportProgress: string = '';

  rowsPerPageOptions = [20, 50, 100];
  pageSize = 20;

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
  isBankAccountsFeatureEnabled: boolean = true;

  // ⚠️ NEW: Reconciliation status properties
  reconciliationStatus: ReconciliationStatus | null = null;
  isCheckingReconciliation: boolean = false;
  expenseReconciliationCache: Map<number, ReconciliationStatus> = new Map(); // Cache reconciliation status per expense

  /** Set in constructor from `router.navigate(..., { state: { openEditExpensePayload } })` (e.g. expense details). */
  private pendingOpenEditExpense: Expense | null = null;

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
    private route: ActivatedRoute,
    private paymentValidationService: PaymentValidationService,
    private reconciliationValidationService: ReconciliationValidationService,
    private organizationService: OrganizationService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    private licenseCapabilitiesService: LicenseCapabilitiesService) {
    const nav = this.router.getCurrentNavigation();
    const st = nav?.extras?.state as { openEditExpensePayload?: Expense } | undefined;
    if (st?.openEditExpensePayload) {
      this.pendingOpenEditExpense = st.openEditExpensePayload;
    }
  }

  async ngOnInit() {
    this.isLoading = true;
    initTablePageSizeState(TablePageSizeKeys.expenses, this.rowsPerPageOptions, {
      pageSize: this.pageSize,
      lastLazyLoadEvent: this.lastLazyLoadEvent,
    });
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
      this.translate.use(lang);
      this.refreshExpenseStatusFilterOptions();
    });
    this.refreshExpenseStatusFilterOptions();
    
    // Load data
    await Promise.all([
      this.onGetAllShops(),
      this.loadBankAccounts(),
      this.checkPermissions(),
      this.setUserRoles(),
      this.loadUserShopId(),
      this.loadLicenseCapabilities(),
    ]);

    await this.loadExpenseConfig();

    const qpStatus = this.route.snapshot.queryParamMap.get('status');
    if (qpStatus) {
      const upper = qpStatus.trim().toUpperCase();
      const allowed: ExpenseStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
      if (allowed.includes(upper as ExpenseStatus)) {
        this.selectedExpenseStatus = upper as ExpenseStatus;
      }
    }

    this.initializePaymentMethods();
    this.cols = [
      { field: 'reference', header: this.translateService.instant('expense_reference') },
      { field: 'purpose', header: this.translateService.instant('expense_purpose') },
      { field: 'dateOfExpense', header: this.translateService.instant('expense_date') },
      { field: 'amount', header: this.translateService.instant('expense_amount') },
      { field: 'shop', header: this.translateService.instant('shop') },
      { field: 'status', header: this.translateService.instant('expense_status') },
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

    if (this.pendingOpenEditExpense) {
      const toEdit = this.pendingOpenEditExpense;
      this.pendingOpenEditExpense = null;
      if (this.canEditExpense && expenseWorkflowAllowsEdit(toEdit)) {
        await this.editExpense(toEdit);
      }
    }
    
    // Initial load: apply default status filter for approvers when approval workflow is on
    if (this.selectedExpenseStatus) {
      this.applyFilters();
    } else {
      this.loadExpenses();
    }
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  private async loadUserShopId(): Promise<void> {
    try {
      const profile = await this.keycloakService.loadUserProfile();
      const raw = profile?.attributes?.['shop']?.[0];
      this.userShopId = raw != null && raw !== '' ? Number(raw) : null;
    } catch {
      this.userShopId = null;
    }
  }

  private async loadExpenseConfig(): Promise<void> {
    try {
      const cfg = await firstValueFrom(this.expenseService.getExpenseConfig());
      this.requireApproval = !!cfg?.requireApproval;
      if (this.requireApproval && this.hasExpenseApprovalRole()) {
        this.selectedExpenseStatus = 'PENDING';
      }
    } catch (e) {
      console.warn('Expense config unavailable, using defaults', e);
      this.requireApproval = false;
    } finally {
      this.expenseConfigLoaded = true;
    }
  }

  hasExpenseApprovalRole(): boolean {
    const r = this.userRoles || [];
    return r.includes('ADMIN') || r.includes('ACCOUNTANT') || r.includes('WAREHOUSEMAN');
  }

  canApproveExpenseRow(expense: Expense): boolean {
    if (!expense || expense.status !== 'PENDING') {
      return false;
    }
    if (!this.hasExpenseApprovalRole()) {
      return false;
    }
    if (this.isAdmin) {
      return true;
    }
    if (this.userShopId == null || expense.shop?.shopId == null) {
      return false;
    }
    return Number(expense.shop.shopId) === Number(this.userShopId);
  }

  canRejectExpenseRow(expense: Expense): boolean {
    return this.canApproveExpenseRow(expense);
  }

  openApproveDialog(expense: Expense, event?: Event): void {
    event?.stopPropagation();
    this.expensePendingAction = expense;
    this.approveExpenseDialog = true;
  }

  openRejectDialog(expense: Expense, event?: Event): void {
    event?.stopPropagation();
    this.expensePendingAction = expense;
    this.rejectionReason = '';
    this.rejectExpenseDialog = true;
  }

  confirmApproveExpense(): void {
    const exp = this.expensePendingAction;
    if (!exp?.id) {
      return;
    }
    this.isApprovalActionLoading = true;
    this.expenseService.approveExpense(exp.id).subscribe({
      next: () => {
        this.isApprovalActionLoading = false;
        this.approveExpenseDialog = false;
        this.expensePendingAction = null;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('expense_approved_success'),
          life: 3000
        });
        this.loadExpenses();
      },
      error: (err: any) => {
        this.isApprovalActionLoading = false;
        const msg = err?.error?.message || err?.message || this.translate.instant('expense_approve_error');
        const severity = err?.status === 403 ? 'error' : err?.status === 409 ? 'warn' : 'error';
        this.messageService.add({
          severity,
          summary: this.translate.instant('error'),
          detail: msg,
          life: 5000
        });
      }
    });
  }

  confirmRejectExpense(): void {
    const exp = this.expensePendingAction;
    if (!exp?.id) {
      return;
    }
    this.isApprovalActionLoading = true;
    this.expenseService.rejectExpense(exp.id, this.rejectionReason || undefined).subscribe({
      next: () => {
        this.isApprovalActionLoading = false;
        this.rejectExpenseDialog = false;
        this.rejectionReason = '';
        this.expensePendingAction = null;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('expense_rejected_success'),
          life: 3000
        });
        this.loadExpenses();
      },
      error: (err: any) => {
        this.isApprovalActionLoading = false;
        const msg = err?.error?.message || err?.message || this.translate.instant('expense_reject_error');
        const severity = err?.status === 403 ? 'error' : err?.status === 409 ? 'warn' : 'error';
        this.messageService.add({
          severity,
          summary: this.translate.instant('error'),
          detail: msg,
          life: 5000
        });
      }
    });
  }

  getExpenseStatusLabel(status: string | undefined): string {
    if (!status) {
      return '-';
    }
    const key = `expense_status_${String(status).toLowerCase()}`;
    const t = this.translate.instant(key);
    return t !== key ? t : status;
  }

  /** CSS classes aligned with global badges (orders / returns). */
  getExpenseStatusBadgeClass(status: string | undefined): string {
    if (!status) {
      return 'expense-badge';
    }
    const suffix = String(status).toLowerCase().replace(/\s+/g, '_');
    return `expense-badge expense-${suffix}`;
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
    if (!this.canEditExpense || !expenseWorkflowAllowsEdit(expense)) {
      return;
    }

    // Check reconciliation status if required
    if (expense.id && this.requiresReconciliation(expense.paymentMethod)) {
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

  onBankAccountSelectionChange(): void {
    this.expense.bankAccountId = this.selectedBankAccount?.accountId ?? undefined;
  }

  async deleteExpense(expense: Expense) {
    if (!this.canDeleteExpense || !expenseWorkflowAllowsDelete(expense)) {
      return;
    }

    // Check reconciliation status if required
    if (expense.id && this.requiresReconciliation(expense.paymentMethod)) {
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

  private async loadLicenseCapabilities(): Promise<void> {
    try {
      await this.licenseCapabilitiesService.ensureLoaded();
      this.isBankAccountsFeatureEnabled = this.licenseCapabilitiesService.isFeatureEnabled('BANK_ACCOUNTS');
    } catch (error) {
      console.warn('Unable to resolve license capabilities for bank account methods.', error);
      this.isBankAccountsFeatureEnabled = true;
    }
  }

  canEditExpenseByWorkflowStatus(expense: Expense | null | undefined): boolean {
    return expenseWorkflowAllowsEdit(expense);
  }

  canDeleteExpenseByWorkflowStatus(expense: Expense | null | undefined): boolean {
    return expenseWorkflowAllowsDelete(expense);
  }

  // ⚠️ NEW: Helper methods for template
  requiresReconciliation(paymentMethod: string | null | undefined): boolean {
    return this.reconciliationValidationService.requiresExpenseBankImpactCheck(paymentMethod);
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

    const requiresBankFeature = ['Transfer', 'Check', 'BOE'].includes(this.expense.paymentMethod || '');
    if (requiresBankFeature && !this.isBankAccountsFeatureEnabled) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Upgrade required',
        detail: 'Bank transfer, check and BOE expense methods require a higher plan.',
        life: 7000
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
      const payload = buildExpenseWritePayload(this.expense);

      let savedExpense: Expense | null = null;
      if (this.expense.id) {
        savedExpense = await this.updateExpense(this.expense.id, payload);
      } else {
        savedExpense = await this.addExpense(payload);
      }

      // Bank posting on server runs after approval when workflow is on; avoid duplicate client-side bank tx until approved
      const approved =
        !savedExpense?.status || String(savedExpense.status).toUpperCase() === 'APPROVED';
      const pm = (savedExpense?.paymentMethod || '').toUpperCase();
      const requiresBankAccount =
        savedExpense &&
        approved &&
        ['BANK_TRANSFER', 'CHECK', 'BOE', 'TRANSFER'].includes(pm);

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
    this.globalFilter = value;
    this.lastLazyLoadEvent.first = 0;
    this.loadExpenses();
  }

  private initializePaymentMethods() {
    // Payment methods for expenses (same as payments)
    this.paymentMethods = paymentMethodOptions.map(opt => ({
      label: opt.label,
      value: opt.value
    }));
  }

  onLazyLoad(event: LazyLoadEvent) {
    this.lazyLoadCallCount++;
    
    // Skip if this is the first lazy load call and we've already loaded expenses manually
    // This prevents the automatic lazy table trigger from reloading with wrong sort order
    if (this.lazyLoadCallCount === 1 && this.expenses.length > 0) {
      // This is the automatic lazy load trigger after manual load
      // Skip it to prevent double loading
      this.isInitialLoad = false;
      return;
    }
    
    const extendedEvent: LazyLoadEventExt = {
      ...event,
      globalFilter: this.globalFilter
    };

    this.updateLastLazyLoadEvent(extendedEvent);
    this.loadExpenses();
  }

  updateLastLazyLoadEvent(event: LazyLoadEventExt) {
    persistTablePageSizeFromLazyEvent(TablePageSizeKeys.expenses, this.rowsPerPageOptions, event, {
      pageSize: this.pageSize,
    });
    const rows = event.rows || this.lastLazyLoadEvent.rows || this.pageSize;
    // Default to DESC (-1) for newest first
    const defaultSortOrder = -1; // DESC - newest first
    let sortOrder = defaultSortOrder;
    
    // On initial load (first lazy load call), always use DESC regardless of what the event says
    // After initial load, respect user's sort choice
    if (this.isInitialLoad || this.lazyLoadCallCount <= 1) {
      sortOrder = defaultSortOrder;
      if (this.lazyLoadCallCount > 0) {
        this.isInitialLoad = false;
      }
    } else {
      // Only use event.sortOrder if it's explicitly 1 (ASC) or -1 (DESC)
      if (event.sortOrder !== undefined && event.sortOrder !== null && event.sortOrder !== 0) {
        if (event.sortOrder === 1 || event.sortOrder === -1) {
          sortOrder = event.sortOrder;
        }
      }
    }
    
    this.lastLazyLoadEvent = {
      first: event.first || 0,
      rows,
      sortField: event.sortField || 'dateOfExpense',
      sortOrder: sortOrder,
      globalFilter: event.globalFilter || this.globalFilter,
      filters: event.filters || this.lastLazyLoadEvent.filters || {}
    };
  }

  onFilterChange() {
    this.applyFilters();
  }

  applyFilters() {
    const filters: any = {};
    
    if (this.selectedPaymentMethod) {
      filters['paymentMethod'] = { value: this.selectedPaymentMethod, matchMode: 'equals' };
    }
    
    if (this.selectedShop) {
      filters['shopName'] = { value: this.selectedShop.shopName, matchMode: 'equals' };
    }

    if (this.selectedExpenseStatus) {
      filters['expenseStatus'] = { value: this.selectedExpenseStatus, matchMode: 'equals' };
    }
    
    if (this.startDate) {
      filters['dateOfExpenseFrom'] = { value: this.startDate, matchMode: 'dateIs' };
    }
    
    if (this.endDate) {
      filters['dateOfExpenseTo'] = { value: this.endDate, matchMode: 'dateIs' };
    }
    
    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      filters: filters
    };
    
    this.updateLastLazyLoadEvent(lazyEvent);
    this.loadExpenses();
  }

  clearFilters() {
    this.selectedPaymentMethod = null;
    this.selectedShop = null;
    this.selectedExpenseStatus = null;
    this.startDate = null;
    this.endDate = null;
    this.globalFilter = '';
    
    this.lastLazyLoadEvent.first = 0;
    this.lastLazyLoadEvent.filters = {};
    
    const resetEvent: LazyLoadEvent = {
      first: 0,
      rows: this.lastLazyLoadEvent.rows || 20,
      sortField: 'dateOfExpense',
      sortOrder: -1
    };
    
    this.onLazyLoad(resetEvent);
  }

  clear(table: Table) {
    table.clear();
  }

  loadExpenses() {
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;

    const page = first! / rows!;
    const size = rows!;
    const direction = sortOrder === 1 ? 'ASC' : 'DESC';
    
    // Pass filters as-is - the service expects { field: { value: ..., matchMode: ... } } format
    const filterPayload = filters || {};

    this.expenseService.getExpensesPaginated(
      page,
      size,
      globalFilter || '',
      sortField!,
      direction,
      filterPayload
    ).subscribe({
      next: (res: any) => {
        // Assign the paginated expenses
        this.expenses = res.page.content.map((e: any) => {
          return {
            ...e,
            creationDate: e.creationDate ? new Date(e.creationDate) : null,
            dateOfExpense: e.dateOfExpense ? new Date(e.dateOfExpense) : null,
            checkExpirationDate: e.checkExpirationDate ? new Date(e.checkExpirationDate) : null,
            boeExpirationDate: e.boeExpirationDate ? new Date(e.boeExpirationDate) : null
          };
        });

        // Assign total records from backend
        this.totalRecords = res.totalExpenses || res.page?.totalElements || 0;
        this.totalAmountFiltered =
          res.totalAmount != null ? res.totalAmount : (res.page?.totalAmount != null ? res.page.totalAmount : null);

        this.isLoading = false;
        // Don't set isInitialLoad = false here - let onLazyLoad handle it
        
        // Trigger change detection to ensure table updates
        if (this.cdr) {
          this.cdr.detectChanges();
        }
      },
      error: (err: any) => {
        console.error(err);
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_expenses'),
          life: 3000
        });
      }
    });
  }

  async onGetAllExpenses() {
    // For backward compatibility, call loadExpenses
    this.loadExpenses();
  }

  async onDeleteExpense(id: any) {
    // Find the expense to check its payment method
    const expenseToDelete = this.expenses.find(e => e.id === id);
    
    // Check reconciliation status before deleting (refresh to ensure it's current)
    if (expenseToDelete && this.requiresReconciliation(expenseToDelete.paymentMethod)) {
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
          this.loadExpenses();
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

  async onGetAllShops(): Promise<Shop[]> {
    try {
      const response = await firstValueFrom(this.shopService.getShops()) as Shop[];
      this.shops = response;
      console.log(this.shops);
      return response;
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translateService.instant('error'),
        detail: this.translateService.instant('error_getting_shops'),
        life: 3000,
      });
      console.log(err);
      return [];
    }
  }

  async loadBankAccounts() {
    // BANK_ACCOUNTS is PRO+. This ran on every visit to Expenses and 403'd on STARTER.
    await this.licenseCapabilitiesService.ensureLoaded();
    this.isBankAccountsFeatureEnabled = this.licenseCapabilitiesService.isFeatureEnabled('BANK_ACCOUNTS');
    if (!this.isBankAccountsFeatureEnabled) {
      this.bankAccounts = [];
      return;
    }
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
      if (this.requiresReconciliation(expense.paymentMethod)) {
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
    const payload = buildExpenseWritePayload(expense);
    this.expenseService.updateExpense(id, payload)
      .subscribe({
          next: (response: Expense) => {
            // Clear cache for this expense
            this.expenseReconciliationCache.delete(id);
            this.loadExpenses();
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
            this.loadExpenses();
            const pending =
              this.requireApproval &&
              response?.status &&
              String(response.status).toUpperCase() === 'PENDING';
            this.messageService.add({
              severity: 'success',
              summary: this.translateService.instant('successful'),
              detail: pending
                ? this.translateService.instant('expense_submitted_pending_approval')
                : this.translateService.instant('expense_added'),
              life: pending ? 5000 : 3000
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
        reference: expense.reference || `EXP-${expense.id}`,
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

  async exportPdf() {
    if (this.isExporting) { return; }
    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('exporting'),
        detail: this.translate.instant('exporting_pdf_please_wait') || 'Exporting PDF, please wait...',
        life: 3000
      });

      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      await firstValueFrom(this.translate.getTranslation(defaultLocale));

      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredExpenses: any[] = [];
      let currentPage = 0;
      const pageSize = 1000;
      let hasMorePages = true;
      const maxPages = 100;

      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
      const direction = sortOrder === 1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...filters };

      this.expenseService.loadToken();

      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;

        const response: any = await firstValueFrom(
          this.expenseService.getExpensesPaginated(
            currentPage,
            pageSize,
            globalFilter || '',
            sortField || 'dateOfExpense',
            direction,
            filterPayload
          )
        );

        const pageContent = response.page?.content || response.content || [];
        allFilteredExpenses = allFilteredExpenses.concat(pageContent);

        const totalElements = response.page?.totalElements || response.totalElements || 0;
        hasMorePages = allFilteredExpenses.length < totalElements && pageContent.length > 0;
        currentPage++;
      }

      if (allFilteredExpenses.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('no_data_to_export') || 'No data available to export',
          life: 3000
        });
        this.isExporting = false;
        this.exportProgress = '';
        this.translate.use(currentLang);
        return;
      }

      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';

      const exportColumns: ExportColumn[] = [
        { title: this.translate.instant('expense_reference'), dataKey: 'reference' },
        { title: this.translate.instant('expense_purpose'), dataKey: 'purpose' },
        { title: this.translate.instant('expense_date'), dataKey: 'dateOfExpense' },
        { title: this.translate.instant('expense_amount'), dataKey: 'amount' },
        { title: this.translate.instant('shop'), dataKey: 'shop' },
        { title: this.translate.instant('expense_status'), dataKey: 'expenseStatus' }
      ];

      const pdfTitle = this.translate.instant('expenses_menu_title') || this.translate.instant('expenses');

      const exportData = allFilteredExpenses.map(expense => {
        const exportItem: any = {
          reference: expense.reference || (expense.id != null ? `#${expense.id}` : 'N/A'),
          purpose: expense.purpose || 'N/A',
          dateOfExpense: expense.dateOfExpense ? this.datePipe.transform(expense.dateOfExpense, 'dd/MM/yyyy') : 'N/A',
          amount: expense.amount || 0,
          shop: expense.shop?.shopName || expense.shop?.name || 'N/A',
          expenseStatus: expense.status ? this.translate.instant(`expense_status_${String(expense.status).toLowerCase()}`) : 'N/A'
        };
        return exportItem;
      });

      this.reportingService.exportPdf(exportColumns, exportData, 'expenses', pdfTitle);
      this.translate.use(currentLang);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredExpenses.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting expenses PDF:', error);
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
    if (this.isExporting) { return; }
    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('exporting'),
        detail: this.translate.instant('exporting_excel_please_wait') || 'Exporting Excel, please wait...',
        life: 3000
      });

      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      await firstValueFrom(this.translate.getTranslation(defaultLocale));

      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredExpenses: any[] = [];
      let currentPage = 0;
      const pageSize = 1000;
      let hasMorePages = true;
      const maxPages = 100;

      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
      const direction = sortOrder === 1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...filters };

      this.expenseService.loadToken();

      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;

        const response: any = await firstValueFrom(
          this.expenseService.getExpensesPaginated(
            currentPage,
            pageSize,
            globalFilter || '',
            sortField || 'dateOfExpense',
            direction,
            filterPayload
          )
        );

        const pageContent = response.page?.content || response.content || [];
        allFilteredExpenses = allFilteredExpenses.concat(pageContent);

        const totalElements = response.page?.totalElements || response.totalElements || 0;
        hasMorePages = allFilteredExpenses.length < totalElements && pageContent.length > 0;
        currentPage++;
      }

      if (allFilteredExpenses.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('no_data_to_export') || 'No data available to export',
          life: 3000
        });
        this.isExporting = false;
        this.exportProgress = '';
        this.translate.use(currentLang);
        return;
      }

      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';

      const translatedExpenses = allFilteredExpenses.map(expense => {
        const translated: any = {
          [this.translate.instant('expense_reference')]: expense.reference || (expense.id != null ? `#${expense.id}` : 'N/A'),
          [this.translate.instant('expense_purpose')]: expense.purpose || 'N/A',
          [this.translate.instant('expense_date')]: expense.dateOfExpense ? this.datePipe.transform(expense.dateOfExpense, 'dd/MM/yyyy') : 'N/A',
          [this.translate.instant('expense_amount')]: expense.amount || 0,
          [this.translate.instant('shop')]: expense.shop?.shopName || expense.shop?.name || 'N/A',
          [this.translate.instant('expense_status')]: expense.status
            ? this.translate.instant(`expense_status_${String(expense.status).toLowerCase()}`)
            : 'N/A'
        };
        return translated;
      });

      this.reportingService.exportExcel(translatedExpenses, 'expenses');
      this.translate.use(currentLang);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredExpenses.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting expenses Excel:', error);
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

  showExpenseDetails(expense: any) {
    if (!expense || !expense.id) return;
    this.router.navigate(['/finance/expenses', expense.id]);
  }

  /** Shown in grids when API returns reference (older rows may only have id). */
  displayExpenseReference(expense: Expense | null | undefined): string {
    if (!expense) {
      return '—';
    }
    if (expense.reference && String(expense.reference).trim()) {
      return String(expense.reference).trim();
    }
    return expense.id != null ? `#${expense.id}` : '—';
  }

  expenseStatusFilterOptions: { label: string; value: ExpenseStatus | null }[] = [];

  private refreshExpenseStatusFilterOptions(): void {
    this.expenseStatusFilterOptions = [
      { label: this.translate.instant('all'), value: null },
      { label: this.translate.instant('expense_status_pending'), value: 'PENDING' },
      { label: this.translate.instant('expense_status_approved'), value: 'APPROVED' },
      { label: this.translate.instant('expense_status_rejected'), value: 'REJECTED' }
    ];
  }

}
