import { Component, EventEmitter, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService, LazyLoadEvent } from 'primeng/api';
import { Table } from 'primeng/table';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { CustomerService } from 'src/app/services/customer.service';
import { Customer } from 'src/app/models/customer';
import { Order } from 'src/app/models/order';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { Refund } from 'src/app/models/refund';
import { RefundService } from 'src/app/services/refund.service';
import { RefundMethod } from 'src/app/enums/refund-method.enum';
import { RefundStatus } from 'src/app/enums/refund-status.enum';
import { ReturnService } from 'src/app/services/return.service';
import { OrderReturn } from 'src/app/models/orderReturn';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { BankAccount } from 'src/app/models/bank-account';
import { PaymentValidationService } from 'src/app/services/payment-validation.service';
import { CustomerCreditService } from 'src/app/services/customer-credit.service';
import { CreditInfo } from 'src/app/models/credit-info';
import { ReconciliationValidationService, ReconciliationStatus } from 'src/app/services/reconciliation-validation.service';
import { BankTransaction } from 'src/app/models/bank-transaction';
import { firstValueFrom } from 'rxjs';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { DatePipe } from '@angular/common';

interface LazyLoadEventExt extends LazyLoadEvent {
  globalFilter?: string;
  filters?: { [field: string]: any };
}

@Component({
  templateUrl: './refunds.component.html',
  styleUrls: ['./refunds.component.css', '../finance.component.css'],
  providers: [MessageService, DatePipe]
})
export class RefundsComponent implements OnInit {

  Ressource: string = 'REFUNDS';

  refundDialog: boolean = false;

  deleteRefundDialog: boolean = false;

  deleteRefundsDialog: boolean = false;

  confirmRefundDialog: boolean = false;

  currency: any;

  maxRefundAmount: number = 0;

  eligibleReturns: OrderReturn[] = [];

  refunds: Refund[] = [];

  refund: Refund = {};

  customers: Customer[] = [];

  customer: Customer = {};

  selectedRefunds: Refund[] = [];

  unpaidOrders: Order[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  returnStatuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  exportColumns!: ExportColumn[];

  userRoles: any;
  isAdmin: boolean = false;

  // Refund methods - values aligned with backend enum: CASH, CARD, CHECK, TRANSFER, BOE, DIGITAL_WALLET
  refundMethods = [
    { value: 'CASH', label: 'refund_method_cash' },
    { value: 'CARD', label: 'refund_method_card' },
    { value: 'CHECK', label: 'refund_method_check' },
    { value: 'TRANSFER', label: 'refund_method_transfer' },
    { value: 'BOE', label: 'refund_method_boe' },
    { value: 'DIGITAL_WALLET', label: 'refund_method_digital_wallet' },
  ];

  canAddRefund: boolean = false;
  canEditRefund: boolean = false;
  canDeleteRefund: boolean = false;
  canReadRefund: boolean = false;
  isLoading: boolean = true;
  refundStatuses: any[] = [];
  
  // Filter properties
  selectedRefundStatus: string | null = null;
  selectedRefundMethod: string | null = null;
  selectedCustomer: Customer | null = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  showAdvancedFilters = false;
  
  maxRefundDate: Date;
  
  // Lazy loading properties
  totalRecords: number = 0;
  globalFilter: string = '';
  lastLazyLoadEvent: LazyLoadEventExt = {
    first: 0,
    rows: 20,
    sortField: 'refundDate',
    sortOrder: -1
  };
  
  isExporting: boolean = false;
  exportProgress: string = '';
  bankAccounts: BankAccount[] = [];
  showBankAccountField: boolean = false;
  isBankAccountRequired: boolean = false;
  minimumAmountHint: string | null = null;
  creditInfo: CreditInfo | null = null;

  // ⚠️ NEW: Reconciliation status properties
  reconciliationStatus: ReconciliationStatus | null = null;
  isCheckingReconciliation: boolean = false;
  refundReconciliationCache: Map<number, ReconciliationStatus> = new Map(); // Cache reconciliation status per refund

  constructor(private messageService: MessageService,
    private refundService: RefundService,
    private customerService: CustomerService,
    private configService: AppConfigurationService,
    private returnService: ReturnService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private router: Router,
    private bankAccountService: BankAccountService,
    private paymentValidationService: PaymentValidationService,
    private customerCreditService: CustomerCreditService,
    private reconciliationValidationService: ReconciliationValidationService,
    private organizationService: OrganizationService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef) { }

  async ngOnInit() {
    this.isLoading = true;
    this.maxRefundDate = new Date(); // Today's date
    this.maxRefundDate.setHours(23, 59, 59, 999); // Include entire current day
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
    
    // Load data
    await Promise.all([
      this.loadBankAccounts(),
      this.setUserRoles(),
      this.checkPermissions(),
    ]);
    
    this.cols = [
      { field: 'refundId', header: this.translateService.instant('ID') },
      { field: 'transactionId', header: this.translateService.instant('refund_transaction_id') },
      { field: 'orderReturn.reference', header: this.translateService.instant('return_reference') },
      { field: 'amount', header: this.translateService.instant('refund_amount') },
      { field: 'refundMethod', header: this.translateService.instant('refund_method') },
      { field: 'status', header: this.translateService.instant('refund_status') },
      { field: 'refundDate', header: this.translateService.instant('refund_date') },
    ];

    this.returnStatuses = [
      { label: 'Pending', value: 'PENDING' },
      { label: 'Canceled', value: 'CANCELED' },
      { label: 'Completed', value: 'COMPLETED' },
      { label: 'Partially_Refunded', value: 'PARTIALLY_REFUNDED' },
      { label: 'Processing', value: 'PROCESSING' },
    ];

    // Initialize refund statuses for filters (based on backend enum: PENDING, SETTLED, PARTIAL_REFUND, FAILED)
    this.refundStatuses = [
      { value: 'PENDING', label: 'refund_status_pending' },
      { value: 'SETTLED', label: 'refund_status_settled' },
      { value: 'PARTIAL_REFUND', label: 'refund_status_partial_refund' },
      { value: 'FAILED', label: 'refund_status_failed' }
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
    
    // Load first page of refunds
    await this.loadRefunds();
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddRefund = this.permissionService.canCreate(this.Ressource);
    this.canEditRefund = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteRefund = this.permissionService.canDelete(this.Ressource);
    this.canReadRefund = this.permissionService.canRead(this.Ressource);
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  deleteSelectedRefunds() {
    if (!this.canDeleteRefund) return;
    this.deleteRefundsDialog = true;
  }

  async editRefund(refund: Refund) {
    if (!this.canEditRefund) return;
    await this.loadEligibleReturns();
    await this.loadBankAccounts();
    this.refund = { ...refund };
    await this.updateBankAccountFieldVisibility();
    this.refundDialog = true;
  }

  deleteRefund(refund: Refund) {
    if (!this.canDeleteRefund) return;
    this.deleteRefundDialog = true;
    this.refund = { ...refund };
  }

  confirmDeleteSelected() {
    this.deleteRefundsDialog = false;
    this.selectedRefunds.forEach(selectedRefund => this.onDeleteRefund(selectedRefund.refundId));
    this.selectedRefunds = [];
  }

  async confirmDelete() {
    this.deleteRefundDialog = false;
    await this.onDeleteRefund(this.refund.refundId);
    this.refund = {};
  }

  async openConfirmRefund(refund: Refund) {
    this.confirmRefundDialog = true;
    this.refund = { ...refund };
    
    // Check reconciliation status if required
    if (this.reconciliationValidationService.requiresReconciliation(refund.refundMethod)) {
      try {
        this.isCheckingReconciliation = true;
        this.reconciliationStatus = await this.reconciliationValidationService.checkRefundReconciliationStatus(refund.refundId!);
        this.refundReconciliationCache.set(refund.refundId!, this.reconciliationStatus);
        this.isCheckingReconciliation = false;
      } catch (error) {
        console.error('Error checking reconciliation status:', error);
        this.isCheckingReconciliation = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_reconciliation_status'),
          life: 4000
        });
        // On error, set null status - user can still try to confirm, backend will validate
        this.reconciliationStatus = null;
      }
    } else {
      this.reconciliationStatus = null;
    }
  }

  async confirmRefund() {
    // Check reconciliation status before confirming (refresh status to ensure it's current)
    if (this.refund.refundId && this.reconciliationValidationService.requiresReconciliation(this.refund.refundMethod)) {
      // Refresh reconciliation status
      try {
        this.isCheckingReconciliation = true;
        const status = await this.reconciliationValidationService.checkRefundReconciliationStatus(this.refund.refundId);
        this.reconciliationStatus = status;
        this.refundReconciliationCache.set(this.refund.refundId, status);
        this.isCheckingReconciliation = false;
        
        if (!status.canProceed) {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('cannot_confirm_refund_reconciliation_required'),
            life: 5000
          });
          return; // Don't close dialog, don't confirm
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
        // Set null status - user can still try to confirm, backend will validate
        this.reconciliationStatus = null;
        // Don't return here - allow user to proceed, backend will validate
      }
    }
    
    this.confirmRefundDialog = false;
    await this.onConfirmRefund(this.refund.refundId);
    this.refund = {};
    this.reconciliationStatus = null;
  }

  hideDialog() {
    this.refundDialog = false;
    this.submitted = false;
  }

  async openNew() {
    if (!this.canAddRefund) return;
    await this.loadEligibleReturns();
    await this.loadBankAccounts();
    this.refund = {};
    this.refund.refundDate = new Date();
    this.refund.refundMethod = 'Cash';
    this.refund.status = 'PENDING';
    this.submitted = false;
    await this.updateBankAccountFieldVisibility();
    this.refundDialog = true;
  }

  async loadBankAccounts() {
    try {
      const accounts$ = await this.bankAccountService.getBankAccounts(true);
      const response = await firstValueFrom(accounts$);
      this.bankAccounts = response as BankAccount[];
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  }

  async onRefundMethodChange() {
    await this.updateBankAccountFieldVisibility();
  }

  async updateBankAccountFieldVisibility() {
    if (!this.refund.refundMethod) {
      this.showBankAccountField = false;
      this.isBankAccountRequired = false;
      this.minimumAmountHint = null;
      return;
    }

    this.showBankAccountField = await this.paymentValidationService.shouldShowBankAccountField(this.refund.refundMethod);
    this.isBankAccountRequired = await this.paymentValidationService.isBankAccountRequired(this.refund.refundMethod);
    this.minimumAmountHint = await this.paymentValidationService.getMinimumAmountHint(this.refund.refundMethod, this.currency);

    // Pre-populate bank account from shop's default if available
    if (this.showBankAccountField && this.refund.orderReturn?.order?.shop && !this.refund.bankAccountId) {
      const shopDefaultAccountId = this.refund.orderReturn.order.shop.defaultBankAccount?.accountId || 
                                    this.refund.orderReturn.order.shop.defaultBankAccountId;
      if (shopDefaultAccountId) {
        const defaultAccount = this.bankAccounts.find(acc => acc.accountId === shopDefaultAccountId);
        if (defaultAccount) {
          this.refund.bankAccountId = defaultAccount.accountId;
        }
      }
    }
  }

  isRefundValidForUpdate(refund: any): boolean {
    const today = new Date();
    const refundDate = new Date(refund.refundDate);
    return refundDate.toDateString() === today.toDateString();
  }

  // ⚠️ NEW: Helper methods for template
  requiresReconciliation(refundMethod: string | null | undefined): boolean {
    return this.reconciliationValidationService.requiresReconciliation(refundMethod);
  }

  getRefundReconciliationStatus(refund: Refund): string | null {
    if (!refund.refundId || !this.requiresReconciliation(refund.refundMethod)) {
      return null; // No reconciliation required
    }
    const status = this.refundReconciliationCache.get(refund.refundId);
    if (!status) {
      return 'unknown'; // Status not loaded yet
    }
    return status.allReconciled ? 'reconciled' : 'unreconciled';
  }

  getReturnDisplayLabel = (ret: OrderReturn): string => {
    if (!ret) { return ''; }

    const returnReference = ret.reference ?? 'N/A';
    const reference = ret.order?.reference ?? 'N/A';
    const refundAmt = ret.totalRefundableAmount ?? 0;
    const customer = this.getCustomerDisplayName(ret.order?.customer);

    return `#${returnReference} • ${this.translate.instant('order')} #${reference} • ${refundAmt} ${this.currency} • ${customer}`;
  };

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async saveRefund() {
    this.submitted = true;

    console.log(this.refund);

    if (!this.refund.orderReturn) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    if (this.refund.amount <= 0 || this.refund.amount > this.maxRefundAmount) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('refund_amount_invalid')
      });
      return;
    }

    if (!this.refund.refundDate) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    if (!this.refund.refundMethod) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    if (
      this.refund.refundMethod === 'Check' &&
      (!this.refund.checkNumber || !this.refund.checkExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('check_fields_required')
      });
      return;
    }

    if (
      this.refund.refundMethod === 'BOE' &&
      (!this.refund.boeNumber || !this.refund.boeExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('boe_fields_required')
      });
      return;
    }

    // Validate bank account and minimum amount using validation service
    const validation = await this.paymentValidationService.validateBankPayment(
      this.refund.refundMethod || '',
      this.refund.bankAccountId,
      this.refund.amount,
      'refund'
    );

    if (!validation.valid) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: validation.error || this.translate.instant('validation_error')
      });
      return;
    }

    if (this.refund.refundDate) {
      const date =
        typeof this.refund.refundDate === 'string'
          ? new Date(this.refund.refundDate)
          : this.refund.refundDate;
      this.refund.refundDate = this.formatDate(date);
    }

    if (this.refund.checkExpirationDate) {
      const date =
        typeof this.refund.checkExpirationDate === 'string'
          ? new Date(this.refund.checkExpirationDate)
          : this.refund.checkExpirationDate;
      this.refund.checkExpirationDate = this.formatDate(date);
    }

    if (this.refund.boeExpirationDate) {
      const date =
        typeof this.refund.boeExpirationDate === 'string'
          ? new Date(this.refund.boeExpirationDate)
          : this.refund.boeExpirationDate;
      this.refund.boeExpirationDate = this.formatDate(date);
    }

    if (this.refund.orderReturn) {
      let success = false;

      if (this.refund.refundId) {
        success = await this.updateRefund(this.refund.refundId, this.refund);
      } else {
        success = await this.addRefund(this.refund);
      }

      if (success) {
        // Check if credit was issued (non-cash refunds)
        if (this.refund.refundMethod && this.refund.refundMethod !== 'Cash' && this.refund.orderReturn?.order?.customer?.customerId) {
          // Show notification about credit issuance
          const amountFormatted = (this.refund.amount || 0).toFixed(2);
          const methodLabel = this.translate.instant('payment_method_' + this.refund.refundMethod.toLowerCase());
          this.messageService.add({
            severity: 'info',
            summary: this.translate.instant('credit_issued'),
            detail: `${this.translate.instant('credit_will_be_issued_from_refund')} (${amountFormatted} ${this.currency} via ${methodLabel})`,
            life: 5000,
          });
          
          // Reload credit info to show updated balance
          await this.loadCreditInfo(this.refund.orderReturn.order.customer.customerId);
        } else if (this.refund.refundMethod === 'Cash') {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('cash_refund_processed_immediately'),
            life: 3000,
          });
        }
        
        this.refunds = [...this.refunds];
        this.refundDialog = false;
        this.refund = {};
      }
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
    }
  }

  onOrderSelect(order: Order) {
    if (order) {
      this.maxRefundAmount = order.totalAmount - order.totalPaid;
      // Auto-set the amount to the maximum payable (optional)
      this.refund.amount = this.maxRefundAmount;
    } else {
      this.maxRefundAmount = 0;
      this.refund.amount = null;
    }
  }

  @ViewChild('dt') dt!: Table;

  onLazyLoad(event: LazyLoadEvent) {
    const extendedEvent: LazyLoadEventExt = {
      ...event,
      globalFilter: this.globalFilter
    };

    this.updateLastLazyLoadEvent(extendedEvent);
    this.loadRefunds();
  }

  updateLastLazyLoadEvent(event: LazyLoadEventExt) {
    this.lastLazyLoadEvent = {
      first: event.first || 0,
      rows: event.rows || 20,
      sortField: event.sortField || 'refundDate',
      sortOrder: event.sortOrder || -1,
      globalFilter: event.globalFilter || this.globalFilter,
      filters: event.filters || this.lastLazyLoadEvent.filters || {}
    };
  }

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.globalFilter = value;
    this.lastLazyLoadEvent = {
      ...this.lastLazyLoadEvent,
      first: 0,
      globalFilter: this.globalFilter
    };
    this.loadRefunds();
  }

  onFilterChange() {
    this.applyFilters();
  }

  applyFilters() {
    const filters: any = {};
    
    if (this.selectedRefundStatus) {
      filters['status'] = { value: this.selectedRefundStatus, matchMode: 'equals' };
    }
    
    if (this.selectedRefundMethod) {
      filters['refundMethod'] = { value: this.selectedRefundMethod, matchMode: 'equals' };
    }
    
    if (this.selectedCustomer) {
      filters['customerId'] = { value: this.selectedCustomer, matchMode: 'equals' };
    }
    
    if (this.startDate) {
      filters['refundDateFrom'] = { value: this.startDate, matchMode: 'dateIs' };
    }
    
    if (this.endDate) {
      filters['refundDateTo'] = { value: this.endDate, matchMode: 'dateIs' };
    }
    
    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      filters: filters
    };
    
    this.updateLastLazyLoadEvent(lazyEvent);
    this.loadRefunds();
  }

  clearFilters() {
    this.selectedRefundStatus = null;
    this.selectedRefundMethod = null;
    this.selectedCustomer = null;
    this.startDate = null;
    this.endDate = null;
    this.globalFilter = '';
    
    this.lastLazyLoadEvent.first = 0;
    this.lastLazyLoadEvent.filters = {};
    
    const resetEvent: LazyLoadEvent = {
      first: 0,
      rows: this.lastLazyLoadEvent.rows || 20,
      sortField: 'refundDate',
      sortOrder: -1
    };
    
    this.onLazyLoad(resetEvent);
  }

  clear(table: Table) {
    table.clear();
  }

  loadRefunds() {
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;

    const page = first! / rows!;
    const size = rows!;
    const direction = sortOrder === -1 ? 'ASC' : 'DESC';
    
    // Pass filters as-is - the service expects { field: { value: ..., matchMode: ... } } format
    const filterPayload = filters || {};

    this.refundService.getRefundsPaginated(
      page,
      size,
      globalFilter || '',
      sortField!,
      direction,
      filterPayload
    ).subscribe({
      next: (res: any) => {
        // Assign the paginated refunds
        this.refunds = res.page.content.map((r: any) => {
          return {
            ...r,
            creationDate: r.creationDate ? new Date(r.creationDate) : null,
            refundDate: r.refundDate ? new Date(r.refundDate) : null,
            checkExpirationDate: r.checkExpirationDate ? new Date(r.checkExpirationDate) : null,
            boeExpirationDate: r.boeExpirationDate ? new Date(r.boeExpirationDate) : null
          };
        });

        // Assign total records from backend
        this.totalRecords = res.totalRefunds || res.page?.totalElements || 0;

        // Build unique customers list based on current refunds
        this.loadUniqueCustomersFromRefunds();

        this.isLoading = false;
        
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
          detail: this.translate.instant('error_while_getting_refunds'),
          life: 3000
        });
      }
    });
  }

  /**
   * Build a unique customers list from the currently loaded refunds,
   * so the customer filter shows only customers that actually appear
   * in the refunds table.
   */
  private loadUniqueCustomersFromRefunds() {
    const customerMap = new Map<number, any>();

    this.refunds.forEach(refund => {
      const customer = refund.orderReturn?.order?.customer;
      const customerId = customer?.customerId;
      if (customer && customerId != null && !customerMap.has(customerId)) {
        customerMap.set(customerId, customer);
      }
    });

    this.customers = Array.from(customerMap.values());
  }

  async onGetAllRefunds() {
    // For backward compatibility, call loadRefunds
    this.loadRefunds();
  }

  async onDeleteRefund(id: any) {
    await this.refundService.deleteRefund(id)
      .subscribe({
        next: (response: any) => {
          this.loadRefunds();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('refund_deleted'),
            life: 3000
          });
        },
        error: (err: any) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_deleting_refund'),
            life: 3000
          });
        },
      });
  }


  onConfirmRefund(refundId: any): Promise<boolean> {
    return new Promise((resolve) => {
      this.refundService.confirmRefund(refundId).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('refund_confirmed'),
            life: 3000
          });

          this.loadRefunds();
          resolve(true);
        },
        error: (err: any) => {
          console.error('Error confirming refund:', err);
          
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
              detail: this.translate.instant('cannot_confirm_refund_reconciliation_required'),
              life: 5000
            });
          } else {
            // Generic error message
            const detailMessage = errorMessage || this.translate.instant('error_confirming_refund');
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: detailMessage,
              life: 4000
            });
          }
          
          resolve(false);
        }
      });
    });
  }

  async updateRefund(id: any, refund: any): Promise<any> {
    console.log(refund)
    await this.refundService.updateRefund(id, refund)
      .subscribe({
        next: (response: any) => {
          this.loadRefunds();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('refund_updated'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_refund'),
            life: 3000
          });
          return false;
        },
      })
  }

  addRefund(refund: any): Promise<boolean> {
    return new Promise((resolve) => {
      this.refundService.saveRefund(refund).subscribe({
        next: async (response: any) => {
          this.loadRefunds();
          
          // Check if credit was issued (non-cash refunds)
          const refundMethod = refund.refundMethod || response?.refundMethod;
          const customerId = refund.orderReturn?.order?.customer?.customerId || response?.orderReturn?.order?.customer?.customerId;
          
          if (refundMethod && refundMethod !== 'Cash' && customerId) {
            // Show notification about credit issuance
            const amountFormatted = (refund.amount || response?.amount || 0).toFixed(2);
            const methodLabel = this.translate.instant('payment_method_' + refundMethod.toLowerCase());
            this.messageService.add({
              severity: 'info',
              summary: this.translate.instant('credit_issued'),
              detail: `${this.translate.instant('credit_will_be_issued_from_refund')} (${amountFormatted} ${this.currency} via ${methodLabel})`,
              life: 5000,
            });
            
            // Reload credit info to show updated balance
            await this.loadCreditInfo(customerId);
          } else if (refundMethod === 'Cash') {
            this.messageService.add({
              severity: 'success',
              summary: this.translate.instant('successful'),
              detail: this.translate.instant('cash_refund_processed_immediately'),
              life: 3000,
            });
          } else {
            this.messageService.add({
              severity: 'success',
              summary: this.translate.instant('successful'),
              detail: this.translate.instant('refund_added'),
              life: 3000
            });
          }
          
          resolve(true);
        },
        error: (err: any) => {
          console.error('Error adding refund:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_refund'),
            life: 3000
          });
          resolve(false);
        }
      });
    });
  }

  async onGetAllCustomersWithUnpaidOrders() {
    return new Promise<void>((resolve) => {
      this.customerService.getCustomersWithUnpaidOrders()
        .subscribe({
          next: (response: any) => {
            this.customers = Array.isArray(response) ? response : [];
            this.customers = this.customers.map(customer => ({
              ...customer,
              fullName: `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
            }));
            console.log(this.customers);
            resolve();
          },
          error: (err: any) => {
            console.error('Error fetching customers with unpaid orders', err);
            this.customers = [];
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: this.translate.instant('error_while_getting_customers'),
              life: 3000
            });
            resolve();
          }
        });
    });
  }

  async loadEligibleReturns() {
    this.returnService.getReturnsReadyForRefund().subscribe((returns: OrderReturn[]) => {
      this.eligibleReturns = returns.filter(r => r.totalRefundableAmount > 0);
      console.log(this.eligibleReturns);
    });
  }

  compareReturns = (o1: OrderReturn, o2: OrderReturn): boolean =>
    o1 && o2 ? o1.returnId === o2.returnId : o1 === o2;

  async onReturnSelect(selectedReturn: OrderReturn) {
    if (!selectedReturn) {
      this.maxRefundAmount = 0;
      return;
    }

    const totalRefundable = selectedReturn.totalRefundableAmount || 0;

    const totalAlreadyRefunded = selectedReturn.refunds?.reduce((sum, refund) => {
      return sum + (refund.amount || 0);
    }, 0) || 0;

    this.maxRefundAmount = totalRefundable - totalAlreadyRefunded;

    // Ensure current refund doesn't exceed max
    if (this.refund.amount > this.maxRefundAmount) {
      this.refund.amount = this.maxRefundAmount;
    }

    // Update bank account field visibility and pre-populate from shop default if refund method is already selected
    if (this.refund.refundMethod) {
      await this.updateBankAccountFieldVisibility();
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
      let allFilteredRefunds: any[] = [];
      let currentPage = 0;
      const pageSize = 1000;
      let hasMorePages = true;
      const maxPages = 100;

      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
      const direction = sortOrder === -1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...filters };

      this.refundService.loadToken();

      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;

        const response: any = await firstValueFrom(
          this.refundService.getRefundsPaginated(
            currentPage,
            pageSize,
            globalFilter || '',
            sortField || 'refundDate',
            direction,
            filterPayload
          )
        );

        const pageContent = response.page?.content || response.content || [];
        allFilteredRefunds = allFilteredRefunds.concat(pageContent);

        const totalElements = response.page?.totalElements || response.totalElements || 0;
        hasMorePages = allFilteredRefunds.length < totalElements && pageContent.length > 0;
        currentPage++;
      }

      if (allFilteredRefunds.length === 0) {
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
        { title: this.translate.instant('refund_transaction_id'), dataKey: 'transactionId' },
        { title: this.translate.instant('return_reference'), dataKey: 'returnReference' },
        { title: this.translate.instant('refund_amount'), dataKey: 'amount' },
        { title: this.translate.instant('refund_method'), dataKey: 'refundMethod' },
        { title: this.translate.instant('refund_status'), dataKey: 'status' },
        { title: this.translate.instant('refund_date'), dataKey: 'refundDate' }
      ];

      const pdfTitle = this.translate.instant('refunds_menu_title') || this.translate.instant('refunds');

      const exportData = allFilteredRefunds.map(refund => {
        // Get customer display name
        let customerName = 'N/A';
        if (refund.orderReturn?.order?.customer) {
          customerName = this.getCustomerDisplayName(refund.orderReturn.order.customer);
        }

        // Translate status
        const rawStatus: string = refund.status || '';
        let statusLabel: string = rawStatus;
        if (rawStatus) {
          const key = `refund_status_${rawStatus.toLowerCase()}`;
          const translated = this.translate.instant(key);
          statusLabel = translated && translated !== key ? translated : rawStatus;
        }

        // Translate refund method
        const rawMethod: string = refund.refundMethod || '';
        let methodLabel: string = rawMethod;
        if (rawMethod) {
          const key = `payment_method_${rawMethod.toLowerCase()}`;
          const translated = this.translate.instant(key);
          methodLabel = translated && translated !== key ? translated : rawMethod;
        }

        const exportItem: any = {
          transactionId: refund.transactionId || 'N/A',
          returnReference: refund.orderReturn?.reference || 'N/A',
          amount: refund.amount || 0,
          refundMethod: methodLabel,
          status: statusLabel,
          refundDate: refund.refundDate ? this.datePipe.transform(refund.refundDate, 'dd/MM/yyyy') : 'N/A'
        };
        return exportItem;
      });

      this.reportingService.exportPdf(exportColumns, exportData, 'refunds', pdfTitle);
      this.translate.use(currentLang);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredRefunds.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting refunds PDF:', error);
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
      let allFilteredRefunds: any[] = [];
      let currentPage = 0;
      const pageSize = 1000;
      let hasMorePages = true;
      const maxPages = 100;

      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
      const direction = sortOrder === -1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...filters };

      this.refundService.loadToken();

      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;

        const response: any = await firstValueFrom(
          this.refundService.getRefundsPaginated(
            currentPage,
            pageSize,
            globalFilter || '',
            sortField || 'refundDate',
            direction,
            filterPayload
          )
        );

        const pageContent = response.page?.content || response.content || [];
        allFilteredRefunds = allFilteredRefunds.concat(pageContent);

        const totalElements = response.page?.totalElements || response.totalElements || 0;
        hasMorePages = allFilteredRefunds.length < totalElements && pageContent.length > 0;
        currentPage++;
      }

      if (allFilteredRefunds.length === 0) {
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

      const translatedRefunds = allFilteredRefunds.map(refund => {
        // Translate status
        const rawStatus: string = refund.status || '';
        let statusLabel: string = rawStatus;
        if (rawStatus) {
          const key = `refund_status_${rawStatus.toLowerCase()}`;
          const translated = this.translate.instant(key);
          statusLabel = translated && translated !== key ? translated : rawStatus;
        }

        // Translate refund method
        const rawMethod: string = refund.refundMethod || '';
        let methodLabel: string = rawMethod;
        if (rawMethod) {
          const key = `payment_method_${rawMethod.toLowerCase()}`;
          const translated = this.translate.instant(key);
          methodLabel = translated && translated !== key ? translated : rawMethod;
        }

        const translated: any = {
          [this.translate.instant('refund_transaction_id')]: refund.transactionId || 'N/A',
          [this.translate.instant('return_reference')]: refund.orderReturn?.reference || 'N/A',
          [this.translate.instant('refund_amount')]: refund.amount || 0,
          [this.translate.instant('refund_method')]: methodLabel,
          [this.translate.instant('refund_status')]: statusLabel,
          [this.translate.instant('refund_date')]: refund.refundDate ? this.datePipe.transform(refund.refundDate, 'dd/MM/yyyy') : 'N/A'
        };
        return translated;
      });

      this.reportingService.exportExcel(translatedRefunds, 'refunds');
      this.translate.use(currentLang);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredRefunds.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting refunds Excel:', error);
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

  getRefundedAmount(orderReturn: OrderReturn): number {
    if (!orderReturn.refunds || orderReturn.refunds.length === 0) return 0;
    return orderReturn.refunds.reduce((sum, refund) => sum + (refund.amount || 0), 0);
  }

  getStatusSeverity(status: RefundStatus): string {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'PROCESSING': return 'info';
      case 'PENDING': return 'warning';
      case 'FAILED': return 'danger';
      default: return '';
    }
  }

  getRefundMethodLabel(method: RefundMethod): string {
    // Add translations as needed
    return {
      'Check': 'refund_method_check',
      'Card': 'refund_method_card',
      'Transfer': 'refund_method_cash',
      'Cash': 'refund_method_transfer',
      'BOE': 'refund_method_boe',
      'DIGITAL_WALLET': 'refund_method_digital_wallet'
    }[method] || method;
  }

  getTotalAmount(): number {
    return this.refunds?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  }

  getCustomerDisplayName(customer: any): string {
    if (!customer) return 'N/A';

    if (customer.customerType === 'Company') {
      return customer.companyName || 'Unnamed Company';
    }

    return [customer.firstName, customer.lastName]
      .filter(name => name)
      .join(' ') || 'Unnamed Customer';
  }

  getPaymentMethodIcon(method: string): string {
    switch (method) {
      case 'CASH': return 'pi pi-money-bill';
      case 'CARD': return 'pi pi-credit-card';
      case 'TRANSFER': return 'pi pi-bank';
      case 'CHECK': return 'pi pi-file';
      default: return 'pi pi-wallet';
    }
  }

  getPaymentMethodSeverity(method: string): string {
    switch (method?.toLowerCase()) {
      case 'cash': return 'success';
      case 'card': return 'info';
      case 'transfer': return 'warning';
      case 'check': return 'help';
      case 'boe': return 'help';
      default: return 'danger';
    }
  }


  showRefundDetails(refund: any) {
    if (!refund || !refund.refundId) return;
    this.router.navigate(['/finance/refunds', refund.refundId]);
  }

  // Status methods
  getRefundStatusSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'Initiated': 'info',
      'Processing': 'warning',
      'Completed': 'success',
      'Failed': 'danger',
      'Canceled': 'secondary'
    };
    return severityMap[status] || 'info';
  }

  getRefundStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'Initiated': 'pi pi-plus-circle',
      'Processing': 'pi pi-spinner',
      'Completed': 'pi pi-check-circle',
      'Failed': 'pi pi-times-circle',
      'Canceled': 'pi pi-ban'
    };
    return iconMap[status] || 'pi pi-question-circle';
  }

  async loadCreditInfo(customerId: number): Promise<void> {
    if (!customerId) {
      this.creditInfo = null;
      return;
    }

    try {
      await this.customerCreditService.loadToken();
      const info$ = await this.customerCreditService.getCreditInfo(customerId);
      this.creditInfo = await firstValueFrom(info$);
    } catch (error: any) {
      // Credit account might not exist, that's okay
      console.log('Credit account not found or error loading:', error);
      this.creditInfo = null;
    }
  }
}
