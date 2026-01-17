import { Component, EventEmitter, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
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

@Component({
  templateUrl: './refunds.component.html',
  styleUrls: ['./refunds.component.css', '../finance.component.css'],
  providers: [MessageService]
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

  refundMethods = [
    { value: 'Cash', label: 'refund_method_cash' },
    { value: 'Card', label: 'refund_method_card' },
    { value: 'Check', label: 'refund_method_check' },
    { value: 'BOE', label: 'refund_method_boe' },
    { value: 'Transfer', label: 'refund_method_transfer' },
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
  
  maxRefundDate: Date;
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
    private reconciliationValidationService: ReconciliationValidationService) { }

  async ngOnInit() {
    this.isLoading = true;
    this.maxRefundDate = new Date(); // Today's date
    this.maxRefundDate.setHours(23, 59, 59, 999); // Include entire current day
    await this.paymentValidationService.loadConfigurations();
    await this.loadBankAccounts();
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.onGetAllRefunds();
    this.onGetAllCustomersWithUnpaidOrders(),
      await this.setUserRoles(),
      await this.checkPermissions();
    this.cols = [
      { field: 'refundId', header: this.translateService.instant('ID') },
      { field: 'name', header: this.translateService.instant('refund_name') },
      { field: 'email', header: this.translateService.instant('refund_email') },
      { field: 'phoneNumber', header: this.translateService.instant('refund_phone_number') },
      { field: 'country', header: this.translateService.instant('refund_country') },
      { field: 'city', header: this.translateService.instant('refund_city') },
      { field: 'address', header: this.translateService.instant('refund_address') },
    ];

    this.returnStatuses = [
      { label: 'Pending', value: 'PENDING' },
      { label: 'Canceled', value: 'CANCELED' },
      { label: 'Completed', value: 'COMPLETED' },
      { label: 'Partially_Refunded', value: 'PARTIALLY_REFUNDED' },
      { label: 'Processing', value: 'PROCESSING' },
    ];

    // Initialize refund statuses for filters (based on RefundStatus enum)
    this.refundStatuses = [
      { value: 'PENDING', label: 'refund_status_pending' },
      { value: 'PROCESSING', label: 'refund_status_processing' },
      { value: 'COMPLETED', label: 'refund_status_completed' },
      { value: 'FAILED', label: 'refund_status_failed' },
      { value: 'CANCELLED', label: 'refund_status_cancelled' }
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
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

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (this.dt) {
      this.dt.filterGlobal(value, 'contains');
    }
  }

  onFilterChange() {
    // Apply filters to the table
    if (this.dt) {
      const filters: any = {};
      
      if (this.selectedRefundStatus) {
        filters['status'] = { value: this.selectedRefundStatus, matchMode: 'equals' };
      }
      
      if (this.selectedRefundMethod) {
        filters['method'] = { value: this.selectedRefundMethod, matchMode: 'equals' };
      }
      
      if (this.selectedCustomer) {
        // Filter by customer (using fullName field)
        filters['fullName'] = { value: this.getCustomerDisplayName(this.selectedCustomer), matchMode: 'contains' };
      }
      
      if (this.startDate || this.endDate) {
        if (this.startDate && this.endDate) {
          // Date range filter
          filters['refundDate'] = { value: [this.startDate, this.endDate], matchMode: 'dateBetween' };
        } else if (this.startDate) {
          filters['refundDate'] = { value: this.startDate, matchMode: 'dateIs' };
        } else if (this.endDate) {
          filters['refundDate'] = { value: this.endDate, matchMode: 'dateIs' };
        }
      }
      
      this.dt.filters = filters;
      this.dt.filteredValue = null; // Trigger filtering
    }
  }

  clearFilters() {
    this.selectedRefundStatus = null;
    this.selectedRefundMethod = null;
    this.selectedCustomer = null;
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

  async onGetAllRefunds() {
    await this.refundService.getRefunds()
      .subscribe({
        next: (response: any) => {
          this.refunds = response;
          this.refunds.forEach((refund: any) => {
            refund.creationDate = new Date(<Date>refund.creationDate)
            refund.refundDate = new Date(<Date>refund.refundDate)
            if (refund.checkExpirationDate) {
              refund.checkExpirationDate = new Date(<Date>refund.checkExpirationDate)
            }
            if (refund.boeExpirationDate) {
              refund.boeExpirationDate = new Date(<Date>refund.boeExpirationDate)
            }
          });
        },
        error: (err: any) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_refunds'),
            life: 3000
          });
        },
        complete: () => {
          this.isLoading = false;
          console.log(this.refunds)
        }
      })
  }

  async onDeleteRefund(id: any) {
    await this.refundService.deleteRefund(id)
      .subscribe({
        next: (response: any) => {
          this.onGetAllRefunds();
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

          this.onGetAllRefunds();
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
          this.onGetAllRefunds();
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
          this.onGetAllRefunds();
          
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
    await this.customerService.getCustomersWithUnpaidOrders()
      .subscribe({
        next: (response: any) => {
          this.customers = response;
          this.customers = this.customers.map(customer => ({
            ...customer,
            fullName: `${customer.firstName} ${customer.lastName}`
          }));
          console.log(this.customers);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_customers'),
            life: 3000
          });
        }
      })
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

  exportPdf() {
    this.reportingService.exportPdf(this.exportColumns, this.refunds, 'refunds')
  }

  exportExcel() {
    // Clone the refunds array to avoid modifying the original array
    const modifiedRefunds = this.refunds.map(refund => {
      // Create a copy of the refund object to modify
      const modifiedRefund = { ...refund };

      // Remove the column you want to exclude
      delete modifiedRefund.creationDate;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedRefund['columnToRemove'];

      return modifiedRefund;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedRefunds, 'refunds');
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
