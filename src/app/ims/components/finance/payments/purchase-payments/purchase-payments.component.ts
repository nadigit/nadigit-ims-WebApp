import { Component, EventEmitter, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LazyLoadEvent, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Payment } from 'src/app/models/payment';
import { PaymentService } from 'src/app/services/payment.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { SupplierService } from 'src/app/services/supplier.service';
import { Supplier } from 'src/app/models/supplier';
import { Purchase } from 'src/app/models/purchase';
import { PurchaseService } from 'src/app/services/purchase.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { getPaymentMethodLabel, paymentMethodOptions, getPaymentMethodIcon, getPaymentMethodSeverity, getPaymentStatusSeverity, getPaymentStatusIcon } from 'src/app/shared/payment-utils';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { BankAccount } from 'src/app/models/bank-account';
import { BankTransaction } from 'src/app/models/bank-transaction';
import { firstValueFrom } from 'rxjs';
import { ReconciliationValidationService, ReconciliationStatus } from 'src/app/services/reconciliation-validation.service';
import { DatePipe } from '@angular/common';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';

@Component({
  templateUrl: './purchase-payments.component.html',
  styleUrls: ['./purchase-payments.component.css', '../../finance.component.css'],
  providers: [MessageService, DatePipe]
})
export class PurchasePaymentsComponent implements OnInit {

  @ViewChild('dt') dt!: Table;
  totalRecords: number = 0;
  pageSize: number = 20;
  globalFilter: string = '';

  Ressource: string = 'PAYMENTS';

  paymentDialog: boolean = false;

  deletePaymentDialog: boolean = false;

  confirmPaymentDialog: boolean = false;

  deletePaymentsDialog: boolean = false;

  currency: any;

  maxPaymentAmount: number = 0;

  payments: Payment[] = [];

  payment: Payment = {};

  suppliers: Supplier[] = [];

  selectedPayments: Payment[] = [];

  unpaidPurchases: Purchase[] = [];

  bankAccounts: BankAccount[] = [];
  selectedBankAccount: BankAccount | null = null;

  submitted: boolean = false;

  // ⚠️ NEW: Multi-purchase payment properties
  multiPurchaseMode: boolean = false;
  selectedPurchases: Purchase[] = [];
  purchaseAllocations: Map<number, number> = new Map(); // Map<purchaseId, allocatedAmount>

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  exportColumns!: ExportColumn[];

  isSaving: boolean = false;

  paymentMethodOptions = paymentMethodOptions;

  showCashRegisterWarning = false;

  maxPaymentDate: Date;

  canAddPayment: boolean = false;
  canEditPayment: boolean = false;
  canDeletePayment: boolean = false;
  canReadPayment: boolean = false;
  canConfirmPayment: boolean = false;
  isLoading: boolean = false;
  canBeDeleted: boolean;
  cols: any[];

  lastLazyLoadEvent?: LazyLoadEvent;

  // ⚠️ NEW: Reconciliation status properties
  reconciliationStatus: ReconciliationStatus | null = null;
  isCheckingReconciliation: boolean = false;
  paymentReconciliationCache: Map<number, ReconciliationStatus> = new Map(); // Cache reconciliation status per payment

  // Filter state
  currentFilters: { [field: string]: any } = {};

  // Export state
  isExporting: boolean = false;
  exportProgress: string = '';

  constructor(private messageService: MessageService,
    private paymentService: PaymentService,
    private supplierService: SupplierService,
    private purchaseService: PurchaseService,
    private configService: AppConfigurationService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private financialDocService: FinancialDocumentsService,
    private bankAccountService: BankAccountService,
    private router: Router,
    private reconciliationValidationService: ReconciliationValidationService,
    private organizationService: OrganizationService,
    private datePipe: DatePipe) { }

  async ngOnInit() {
    this.isLoading = true;
    this.maxPaymentDate = new Date(); // Today's date
    this.maxPaymentDate.setHours(23, 59, 59, 999); // Include entire current day
    this.pageSize = 20;
    this.totalRecords = 0; // will be updated after first fetch
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    await this.checkPermissions();
    this.cols = [
      { field: 'transactionId', header: 'payment_transaction_id' },
      { field: 'purchaseReference', header: 'purchase_reference' },
      { field: 'supplierName', header: 'supplier' },
      { field: 'amount', header: 'amount' },
      { field: 'paymentStatus', header: 'payment_status' },
      { field: 'paymentMethod', header: 'payment_method' },
      { field: 'reconciliationStatus', header: 'bank_reconciliation_status' },
      { field: 'paymentDate', header: 'payment_date' }
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
    await this.loadBankAccounts();
    
    // Load suppliers for filter dropdown
    await this.onGetAllSuppliersWithUnpaidPurchases();
    
    // Initial load
    const initialEvent: any = {
      first: 0,
      rows: this.pageSize,
      sortField: 'paymentDate',
      sortOrder: -1
    };
    this.onLazyLoad(initialEvent);
  }

  async loadBankAccounts() {
    try {
      const accounts$ = await this.bankAccountService.getBankAccounts(true);
      this.bankAccounts = await firstValueFrom(accounts$);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddPayment = this.permissionService.canCreate(this.Ressource);
    this.canEditPayment = this.permissionService.canUpdate(this.Ressource);
    this.canDeletePayment = this.permissionService.canDelete(this.Ressource);
    this.canReadPayment = this.permissionService.canRead(this.Ressource);
    this.canConfirmPayment = this.permissionService.canConfirm(this.Ressource);
  }

  deleteSelectedPayments() {
    if (!this.canDeletePayment) return;
    this.deletePaymentsDialog = true;
  }

  editPayment(payment: Payment) {
    if (!this.canEditPayment) return;

    // Clone the payment and set it
    this.payment = { ...payment };

    // Fix: Re-map supplier object for dropdown binding
    if (payment.supplierId) {
      const fullSupplier = this.suppliers.find(s => s.supplierId === payment.supplierId);
      if (fullSupplier) {
        this.payment.supplier = fullSupplier;
      }
    }

    this.purchaseService.getPurchase(payment.purchaseId).toPromise().then(purchase => {
      this.payment.purchase = purchase;
      this.onPurchaseSelect(this.payment.purchase!);
    }).catch(err => {
      console.error('Error fetching purchase for payment:', err);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_fetching_purchase_for_payment'),
        life: 3000
      });
    });

    // Set max payment amount based on selected purchase
    this.onPurchaseSelect(this.payment.purchase!);

    this.paymentDialog = true;
    this.submitted = false; // Reset validation state
  }

  async viewPaymentDetails(payment: any): Promise<void> {
    if (!payment || !payment.paymentId) return;
    this.router.navigate(['/finance/payments/purchase', payment.paymentId]);
  }


  deletePayment(payment: Payment) {
    if (!this.canDeletePayment) return;
    this.deletePaymentDialog = true;
    this.payment = { ...payment };
  }

  async openConfirmPayment(payment: Payment) {
    if (!this.canConfirmPayment) return;
    this.confirmPaymentDialog = true;
    this.payment = { ...payment };
    
    // Check reconciliation status if required
    if (this.reconciliationValidationService.requiresReconciliation(payment.paymentMethod)) {
      try {
        this.isCheckingReconciliation = true;
        this.reconciliationStatus = await this.reconciliationValidationService.checkPaymentReconciliationStatus(payment.paymentId!);
        this.paymentReconciliationCache.set(payment.paymentId!, this.reconciliationStatus);
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
        // Set null status to indicate error - user can still try to confirm, backend will validate
        this.reconciliationStatus = null;
      }
    } else {
      this.reconciliationStatus = null;
    }
  }

  confirmDeleteSelected() {
    this.deletePaymentsDialog = false;
    const selected = this.selectedPayments || [];
    console.log('Deleting selected payments:', selected);
    selected.forEach(payment => this.onDeletePayment(payment.paymentId));
    this.selectedPayments = []; // clear selections
  }

  async confirmDelete() {
    this.deletePaymentDialog = false;
    await this.onDeletePayment(this.payment.paymentId);
    this.payment = {};
  }

  async confirmPayment() {
    // Check reconciliation status before confirming (refresh status to ensure it's current)
    if (this.payment.paymentId && this.reconciliationValidationService.requiresReconciliation(this.payment.paymentMethod)) {
      // Refresh reconciliation status
      try {
        this.isCheckingReconciliation = true;
        const status = await this.reconciliationValidationService.checkPaymentReconciliationStatus(this.payment.paymentId);
        this.reconciliationStatus = status;
        this.paymentReconciliationCache.set(this.payment.paymentId, status);
        this.isCheckingReconciliation = false;
        
        if (!status.canProceed) {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('cannot_confirm_payment_reconciliation_required'),
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
    
    this.confirmPaymentDialog = false;
    await this.onConfirmPayment(this.payment.paymentId);
    this.payment = {};
    this.reconciliationStatus = null;
  }

  hideDialog() {
    this.paymentDialog = false;
    this.submitted = false;
  }

  openNew() {
    if (!this.canAddPayment) return;
    this.payment = {};
    this.selectedBankAccount = null;
    this.onGetAllSuppliersWithUnpaidPurchases();
    this.payment.paymentDate = new Date();
    this.payment.paymentMethod = "Cash";
    this.payment.direction = 'OUTGOING';
    this.submitted = false;
    // ⚠️ NEW: Reset multi-purchase mode
    this.multiPurchaseMode = false;
    this.selectedPurchases = [];
    this.purchaseAllocations.clear();
    this.paymentDialog = true;
  }

  checkCashRegisterStatus() {
    if (!this.payment.paymentDate || this.payment.paymentMethod !== 'Cash') {
      this.showCashRegisterWarning = false;
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paymentDate = new Date(this.payment.paymentDate);
    paymentDate.setHours(0, 0, 0, 0);

    this.showCashRegisterWarning = paymentDate < today;
  }

  hasPaymentMethodDetails(): boolean {
    return !!(this.payment?.checkNumber || this.payment?.boeNumber ||
      this.payment?.checkExpirationDate ||
      this.payment?.boeExpirationDate);
  }

  // Calculate remaining balance
  getPurchaseRemainingBalance(): number {
    if (!this.payment?.purchase?.totalAmount || !this.payment?.purchase?.totalPaid) return 0;
    return this.payment.purchase.totalAmount - this.payment.purchase.totalPaid;
  }

  downloadPaymentPDF(payment: any): void {
    // Implement PDF download logic
    console.log('Downloading payment PDF:', payment);
  }

  sendReceiptByEmail(payment: any): void {
    // Implement email sending logic
    console.log('Sending receipt by email:', payment);
  }

  viewPurchase(purchaseId: number): void {
    // Implement purchase viewing logic
    console.log('Viewing purchase:', purchaseId);
  }


  isPaymentNotSettled(payment: Payment): boolean {
    // A payment is considered "not settled" if its status is not SETTLED
    // This allows editing/deleting payments regardless of when they were created,
    // as long as they haven't been settled yet
    return payment.paymentStatus !== 'SETTLED';
  }


  async savePayment() {
    this.submitted = true;
    console.log('Saving payment:', this.payment);

    // ⚠️ NEW: Handle multi-purchase payment
    if (this.multiPurchaseMode) {
      await this.saveMultiPurchasePayment();
      return;
    }

    // 🔹 Required field validation (single purchase mode)
    if (
      !this.payment.purchase || !this.payment.supplier ||
      !this.payment.amount ||
      !this.payment.paymentMethod ||
      !this.payment.paymentDate
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
      });
      return;
    }

    // 🔹 Validate amount range
    if (this.payment.amount < 0.01 || this.payment.amount > this.maxPaymentAmount) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('payment_amount_invalid', {
          max: this.maxPaymentAmount.toFixed(2),
        }),
      });
      return;
    }

    // 🔹 Warn if paying cash when register is closed
    if (this.showCashRegisterWarning && this.payment.paymentMethod === 'Cash') {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('note'),
        detail: this.translate.instant('cash_register_closed_warning'),
        life: 5000,
      });
    }

    // 🔹 Validate bank account for Transfer, Check, or BOE
    const requiresBankAccount = ['Transfer', 'Check', 'BOE'].includes(this.payment.paymentMethod);
    if (requiresBankAccount && !this.selectedBankAccount) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('bank_account_required'),
      });
      return;
    }

    // 🔹 Validate extra fields for Check / BOE
    if (
      this.payment.paymentMethod === 'Check' &&
      (!this.payment.checkNumber || !this.payment.checkExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('check_fields_required'),
      });
      return;
    }

    if (
      this.payment.paymentMethod === 'BOE' &&
      (!this.payment.boeNumber || !this.payment.boeExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('boe_fields_required'),
      });
      return;
    }

    // 🔹 Overpayment check
    if (this.payment.purchase) {
      const purchase = await this.loadPaymentsForPurchase(this.payment.purchase.purchaseId);
      const payments = purchase?.payments || [];
      const otherPaymentsTotal = payments
        .filter(p => p.paymentId !== this.payment.paymentId)
        .reduce((sum, p) => sum + p.amount, 0);

      if (otherPaymentsTotal + this.payment.amount > purchase.totalAmount) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('payment_exceeds_purchase_total'),
        });
        return;
      }
    }

    // 🔹 Normalize all date fields
    const formatDate = (date: any): string => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    this.payment.paymentDate = formatDate(this.payment.paymentDate);
    if (this.payment.checkExpirationDate)
      this.payment.checkExpirationDate = formatDate(this.payment.checkExpirationDate);
    if (this.payment.boeExpirationDate)
      this.payment.boeExpirationDate = formatDate(this.payment.boeExpirationDate);

    // ⚠️ CRITICAL: Add bankAccount object to payment if bank account is selected (REQUIRED for Check, BOE, and Bank Transfer payments)
    const paymentToSend = { ...this.payment };
    if (requiresBankAccount && this.selectedBankAccount && this.selectedBankAccount.accountId) {
      // Include bankAccount with accountId as per backend specification
      (paymentToSend as any).bankAccount = {
        accountId: this.selectedBankAccount.accountId
      };
    }

    // 🔹 Save or update payment
    this.isSaving = true;
    let savedPayment: Payment | null = null;
    try {
      if (this.payment.paymentId) {
        await this.updatePayment(this.payment.paymentId, paymentToSend);
        savedPayment = this.payment;
      } else {
        savedPayment = await this.addPayment(paymentToSend);
      }

      // 🔹 Record bank transaction if payment method requires it
      if (requiresBankAccount && this.selectedBankAccount && savedPayment) {
        await this.recordBankTransaction(savedPayment);
      }
    } catch (error: any) {
      console.error(error);
      
      // Extract error message from different error formats
      let errorMessage: string = '';
      if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = this.translate.instant('error_occurred');
      }

      // Check if error is related to minimum amount (should be displayed as warning)
      const isMinimumAmountError = errorMessage.toLowerCase().includes('below the minimum required amount') || 
                                   errorMessage.toLowerCase().includes('below the minimum') ||
                                   errorMessage.toLowerCase().includes('minimum required');

      if (isMinimumAmountError) {
        // Display as warning for minimum amount errors
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: errorMessage,
          life: 5000,
        });
      } else {
        // Display as error for other errors
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: errorMessage,
          life: 3000,
        });
      }
    } finally {
      this.isSaving = false;
    }

    // 🔹 Refresh & reset form
    this.payments = [...this.payments];
    this.paymentDialog = false;
    this.payment = {};
    this.selectedBankAccount = null;
    // ⚠️ NEW: Reset multi-purchase mode
    this.multiPurchaseMode = false;
    this.selectedPurchases = [];
    this.purchaseAllocations.clear();
  }

  // ⚠️ NEW: Save multi-purchase payment
  async saveMultiPurchasePayment() {
    // Validation for multi-purchase payment
    if (!this.payment.supplier) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_select_supplier'),
      });
      return;
    }

    if (this.selectedPurchases.length === 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_select_at_least_one_purchase'),
      });
      return;
    }

    // Validate all purchases belong to same supplier
    const supplierId = this.payment.supplier.supplierId;
    const allSameSupplier = this.selectedPurchases.every(purchase => purchase.supplier?.supplierId === supplierId);
    if (!allSameSupplier) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('all_purchases_must_belong_to_same_supplier'),
      });
      return;
    }

    // Validate payment amount and allocations
    if (!this.payment.amount || this.payment.amount < 0.01) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('payment_amount_required'),
      });
      return;
    }

    if (!this.payment.paymentMethod || !this.payment.paymentDate) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
      });
      return;
    }

    // Validate allocations
    const totalAllocated = this.calculateTotalAllocated();
    const paymentAmount = this.payment.amount;
    
    // Allow small difference due to rounding (0.01)
    if (Math.abs(totalAllocated - paymentAmount) > 0.01) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('total_allocated_must_match_payment_amount'),
      });
      return;
    }

    // Validate each allocation
    for (const purchase of this.selectedPurchases) {
      const allocated = this.purchaseAllocations.get(purchase.purchaseId!) || 0;
      const outstanding = this.getPurchaseOutstanding(purchase);

      if (allocated <= 0) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
        detail: this.translate.instant('allocation_amount_must_be_positive', {
          entity: purchase.reference || purchase.purchaseId
        }),
        });
        return;
      }

      if (allocated > outstanding) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
        detail: this.translate.instant('allocation_exceeds_outstanding', {
          entity: purchase.reference || purchase.purchaseId,
          outstanding: outstanding.toFixed(2)
        }),
        });
        return;
      }
    }

    // Validate bank account for Transfer, Check, or BOE
    const requiresBankAccount = ['Transfer', 'Check', 'BOE'].includes(this.payment.paymentMethod);
    if (requiresBankAccount && !this.selectedBankAccount) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('bank_account_required'),
      });
      return;
    }

    // Validate extra fields for Check / BOE
    if (
      this.payment.paymentMethod === 'Check' &&
      (!this.payment.checkNumber || !this.payment.checkExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('check_fields_required'),
      });
      return;
    }

    if (
      this.payment.paymentMethod === 'BOE' &&
      (!this.payment.boeNumber || !this.payment.boeExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('boe_fields_required'),
      });
      return;
    }

    // Format dates
    const formatDate = (date: any): string => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // Build payment object (always OUTGOING for purchases)
    const paymentToSend: any = {
      amount: this.payment.amount,
      paymentMethod: this.payment.paymentMethod,
      paymentDate: formatDate(this.payment.paymentDate),
      direction: 'OUTGOING', // Always OUTGOING for purchases
      notes: this.payment.notes || null,
    };

    // Add bank account if required
    if (requiresBankAccount && this.selectedBankAccount && this.selectedBankAccount.accountId) {
      paymentToSend.bankAccount = {
        accountId: this.selectedBankAccount.accountId
      };
    }

    // Add check/BOE fields
    if (this.payment.paymentMethod === 'Check') {
      paymentToSend.checkNumber = this.payment.checkNumber || null;
      paymentToSend.checkExpirationDate = formatDate(this.payment.checkExpirationDate);
    }

    if (this.payment.paymentMethod === 'BOE') {
      paymentToSend.boeNumber = this.payment.boeNumber || null;
      paymentToSend.boeExpirationDate = formatDate(this.payment.boeExpirationDate);
    }

    // Build purchase allocations
    const purchaseAllocations = this.selectedPurchases.map(purchase => ({
      purchase: {
        purchaseId: purchase.purchaseId
      },
      amount: this.purchaseAllocations.get(purchase.purchaseId!) || 0
    }));

    // Build request
    const request = {
      payment: paymentToSend,
      purchaseAllocations: purchaseAllocations
    };

    // Save payment
    this.isSaving = true;
    try {
      const savedPayment = await firstValueFrom(
        this.paymentService.processMultiPurchasePayment(request)
      );

      // ⚠️ Updated: Show transaction ID and count for multi-purchase payments
      const purchaseCount = this.selectedPurchases.length;
      let successMessage: string;
      if (purchaseCount > 1 && savedPayment.transactionId) {
        successMessage = this.translate.instant('multi_purchase_payment_success', {
          count: purchaseCount,
          transactionId: savedPayment.transactionId
        });
      } else {
        successMessage = this.translate.instant('payment_added');
      }

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: successMessage,
        life: 5000
      });

      // Reset paginator to first page
      if (this.dt) {
        this.dt.first = 0;
      }

      // Reload the first page
      this.onLazyLoad(
        { first: 0, rows: this.lastLazyLoadEvent?.rows || this.pageSize }
      );

      // Reset form
      this.paymentDialog = false;
      this.payment = {};
      this.selectedBankAccount = null;
      this.multiPurchaseMode = false;
      this.selectedPurchases = [];
      this.purchaseAllocations.clear();
    } catch (error: any) {
      console.error('Error saving multi-purchase payment:', error);
      
      // Extract error message
      let errorMessage: string = '';
      if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = this.translate.instant('error_occurred');
      }

      // Check if error is related to minimum amount (should be displayed as warning)
      const isMinimumAmountError = errorMessage.toLowerCase().includes('below the minimum required amount') || 
                                   errorMessage.toLowerCase().includes('below the minimum') ||
                                   errorMessage.toLowerCase().includes('minimum required');

      if (isMinimumAmountError) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: errorMessage,
          life: 5000,
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: errorMessage,
          life: 3000,
        });
      }
    } finally {
      this.isSaving = false;
    }
  }

  async recordBankTransaction(payment: Payment) {
    if (!this.selectedBankAccount || !payment.paymentId) return;

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
        amount: payment.amount || 0,
        transactionDate: formatDateToString(payment.paymentDate),
        description: `Payment to ${payment.supplier?.name || 'Supplier'} - Purchase ${payment.purchase?.reference || ''}`,
        reference: payment.transactionId || `PAY-${payment.paymentId}`,
        checkNumber: payment.checkNumber,
        payment: { paymentId: payment.paymentId },
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


  showPaymentHistory() {
    // Implement payment history view
  }

  onPurchaseSelect(purchase: Purchase) {
    if (!purchase) {
      this.maxPaymentAmount = 0;
      this.payment.amount = null;
      return;
    }
    purchase.payments = [];
    this.loadPaymentsForPurchase(this.payment.purchase.purchaseId).then(payments => {
      purchase.payments = payments;
      console.log(purchase.payments)
      // Calculate total paid excluding THIS payment (if editing)
      const otherPaymentsTotal = purchase.payments
        ?.filter(p => p.paymentId !== this.payment?.paymentId)
        ?.reduce((sum, p) => sum + p.amount, 0) || 0;
      // Calculate maximum allowed amount
      if (this.payment?.paymentId) {
        // When editing: can increase up to remaining balance + current payment amount
        this.maxPaymentAmount = (purchase.totalAmount - otherPaymentsTotal);
      } else {
        // When creating new: can only pay remaining balance
        this.maxPaymentAmount = (purchase.totalAmount - purchase.totalPaid);
      }
      // Auto-set amount to max if not set or invalid
      if (!this.payment.amount || this.payment.amount > this.maxPaymentAmount) {
        this.payment.amount = Math.min(this.maxPaymentAmount, purchase.totalAmount);
      }
    }).catch(err => {
      console.error('Error fetching payments for purchase:', err);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_fetching_payments_for_purchase'),
        life: 3000
      });
    });
  }

  onFilterChange(filters: any) {
    // Update current filters from the payments-table component
    this.currentFilters = {};
    
    if (filters.paymentStatus) {
      this.currentFilters['paymentStatus'] = { value: filters.paymentStatus };
    }
    if (filters.paymentMethod) {
      this.currentFilters['paymentMethod'] = { value: filters.paymentMethod };
    }
    if (filters.supplier) {
      this.currentFilters['supplierId'] = { value: filters.supplier?.supplierId || filters.supplier };
    }
    if (filters.startDate) {
      this.currentFilters['fromDate'] = { value: filters.startDate };
    }
    if (filters.endDate) {
      this.currentFilters['toDate'] = { value: filters.endDate };
    }

    // Trigger reload with current lazy load event
    if (this.lastLazyLoadEvent) {
      this.onLazyLoad(this.lastLazyLoadEvent);
    } else {
      // Initial load
      const initialEvent: any = {
        first: 0,
        rows: this.pageSize,
        sortField: 'paymentDate',
        sortOrder: -1
      };
      this.onLazyLoad(initialEvent);
    }
  }

  onGlobalFilter(event: { globalFilter: string, context?: 'incoming' | 'outgoing' }) {
    const { globalFilter } = event;
    this.globalFilter = globalFilter;

    // Trigger lazy load manually with first page
    const lazyEvent: any = {
      first: 0,
      rows: this.pageSize,
      sortField: null,
      sortOrder: null,
      filters: {},
      globalFilter: this.globalFilter
    };

    this.onLazyLoad(lazyEvent);
  }


  clear(table: Table) {
    table.clear();
  }

  onLazyLoad(event: any) {
    this.lastLazyLoadEvent = event;
    this.isLoading = true;

    // Add sort info to event
    const sortBy = event.sortField || 'paymentDate'; // default sort field
    const sortOrder = event.sortOrder === 1 ? 'ASC' : 'DESC';

    this.loadPayments({ ...event, sortBy, direction: sortOrder });
  }

  loadPayments(event?: any) {
    const page = event?.first ? event.first / event.rows! : 0;
    const size = event?.rows || this.pageSize;
    const sortBy = event?.sortBy || 'paymentDate';
    const direction = event?.direction || 'DESC';

    this.paymentService.getPayments('outgoing', page, size, this.globalFilter, sortBy, direction, this.currentFilters)
      .subscribe({
        next: (res: any) => {
          console.log('Payments response:', res);
          
          // Handle different response structures
          // Backend may return: { page: { content: [], totalElements: 0 } } or { content: [], totalElements: 0 }
          const pageContent = res?.page?.content || res?.content || [];
          const totalElements = res?.page?.totalElements ?? res?.totalElements ?? 0;
          
          // Map payments directly without grouping (same behavior as sales payments)
          this.payments = Array.isArray(pageContent) ? pageContent.map((p: any) => {
            return {
              ...p,
              paymentDate: p.paymentDate ? new Date(p.paymentDate) : null,
              hasReceipt: !!p.receiptNumber
            };
          }) : [];
          
          this.totalRecords = totalElements;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading payments:', err);
          this.payments = [];
          this.totalRecords = 0;
          this.isLoading = false;
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_payments') || 'Error loading payments',
            life: 3000
          });
        }
      });
  }



  async loadPaymentsForPurchase(purchaseId: any) {
    return this.paymentService.getPaymentsByPurchaseId(purchaseId)
      .toPromise()
      .then((response: any) => {
        return response;
      })
      .catch((error: any) => {
        console.error('Error loading payments for purchase:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_payments_for_purchase'),
          life: 3000
        });
        throw error;
      });
  }

  async onDeletePayment(id: any) {
    this.paymentService.deletePayment(id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('payment_deleted'),
          life: 3000
        });

        if (this.lastLazyLoadEvent) {
          this.onLazyLoad(this.lastLazyLoadEvent);
        }
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_deleting_payment'),
          life: 3000
        });
      }
    });
  }

  async updatePayment(
    id: any,
    payment: any
  ): Promise<any> {
    this.paymentService.updatePayment(id, payment).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('payment_updated'),
          life: 3000
        });

        if (this.lastLazyLoadEvent) {
          this.onLazyLoad(this.lastLazyLoadEvent);
        }
      },
      error: (err: any) => {
        console.error(err);
        
        // Extract error message from different error formats
        let errorMessage: string = '';
        if (err?.error?.message) {
          errorMessage = err.error.message;
        } else if (err?.message) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        } else {
          errorMessage = this.translate.instant('error_updating_payment');
        }

        // Check if error is related to minimum amount (should be displayed as warning)
        const isMinimumAmountError = errorMessage.toLowerCase().includes('below the minimum required amount') || 
                                     errorMessage.toLowerCase().includes('below the minimum') ||
                                     errorMessage.toLowerCase().includes('minimum required');

        if (isMinimumAmountError) {
          // Display as warning for minimum amount errors
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: errorMessage,
            life: 5000,
          });
        } else {
          // Display as error for other errors
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: errorMessage,
            life: 3000,
          });
        }
      }
    });
  }

  addPayment(payment: any): Promise<Payment | null> {
    return new Promise((resolve) => {
      this.paymentService.savePayment(payment).subscribe({
        next: (savedPayment: Payment) => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('payment_added'),
            life: 3000
          });

          // Reset paginator to first page
          if (this.dt) {
            this.dt.first = 0;
          }

          // Reload the first page
          this.onLazyLoad(
            { first: 0, rows: this.lastLazyLoadEvent?.rows || this.pageSize }
          );

          resolve(savedPayment);
        },
        error: (err: any) => {
          console.error('Error adding payment:', err);
          
          // Extract error message from different error formats
          let errorMessage: string = '';
          if (err?.error?.message) {
            errorMessage = err.error.message;
          } else if (err?.message) {
            errorMessage = err.message;
          } else if (typeof err === 'string') {
            errorMessage = err;
          } else {
            errorMessage = this.translate.instant('error_confirming_payment');
          }

          // Check if error is related to minimum amount (should be displayed as warning)
          const isMinimumAmountError = errorMessage.toLowerCase().includes('below the minimum required amount') || 
                                       errorMessage.toLowerCase().includes('below the minimum') ||
                                       errorMessage.toLowerCase().includes('minimum required');

          if (isMinimumAmountError) {
            // Display as warning for minimum amount errors
            this.messageService.add({
              severity: 'warn',
              summary: this.translate.instant('warning'),
              detail: errorMessage,
              life: 5000,
            });
          } else {
            // Display as error for other errors
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: errorMessage,
              life: 3000,
            });
          }
          resolve(null);
        }
      });
    });
  }

  onConfirmPayment(paymentId: any): Promise<boolean> {
    return new Promise((resolve) => {
      this.paymentService.confirmPayment(paymentId).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('payment_confirmed'),
            life: 3000
          });

          if (this.lastLazyLoadEvent) {
            this.onLazyLoad(this.lastLazyLoadEvent);
          }

          resolve(true);
        },
        error: (err: any) => {
          console.error('Error adding payment:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_adding_payment'),
            life: 3000
          });
          resolve(false);
        }
      });
    });
  }

  async onGetAllSuppliersWithUnpaidPurchases() {
    return new Promise<void>((resolve) => {
      this.supplierService.getSuppliersWithUnpaidPurchases()
        .subscribe({
          next: (response: any) => {
            this.suppliers = Array.isArray(response) ? response : [];
            console.log(this.suppliers);
            resolve();
          },
          error: (err: any) => {
            console.error('Error fetching suppliers with unpaid purchases', err);
            this.suppliers = [];
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: this.translate.instant('error_while_getting_purchases'),
              life: 3000
            });
            resolve();
          }
        });
    });
  }

  onSupplierSelect(supplier: Supplier) {
    if (supplier?.supplierId) {
      this.purchaseService.getUnpaidPurchasesBySupplier(supplier.supplierId).subscribe({
        next: (purchases: Purchase[]) => {
          console.log(purchases);
          this.unpaidPurchases = purchases;
          this.payment.purchase = null;
          // ⚠️ NEW: Reset multi-purchase selections when supplier changes
          if (this.multiPurchaseMode) {
            this.selectedPurchases = [];
            this.purchaseAllocations.clear();
          }
        },
        error: (err) => {
          console.error('Error fetching unpaid purchases', err);
          this.unpaidPurchases = [];
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_fetching_unpaid_purchases'),
            life: 3000
          });
        }
      });
    } else {
      this.unpaidPurchases = [];
      // ⚠️ NEW: Reset multi-purchase selections when supplier is cleared
      if (this.multiPurchaseMode) {
        this.selectedPurchases = [];
        this.purchaseAllocations.clear();
      }
    }
  }

  // ⚠️ NEW: Handle multi-purchase mode change (called after ngModel updates)
  onMultiPurchaseModeChange(newValue: boolean) {
    // Value is already updated by ngModel, just handle cleanup
    if (!newValue) {
      // Reset to single purchase mode
      this.selectedPurchases = [];
      this.purchaseAllocations.clear();
      this.payment.purchase = null;
    } else {
      // Switch to multi-purchase mode - clear single purchase selection
      this.payment.purchase = null;
    }
  }

  // ⚠️ NEW: Get outstanding balance for a purchase
  getPurchaseOutstanding(purchase: Purchase): number {
    return (purchase.totalAmount || 0) - (purchase.totalPaid || 0);
  }

  // ⚠️ NEW: Calculate total outstanding for selected purchases
  calculateTotalOutstanding(): number {
    return this.selectedPurchases.reduce((sum, purchase) => {
      return sum + this.getPurchaseOutstanding(purchase);
    }, 0);
  }

  // ⚠️ NEW: Toggle purchase selection in multi-purchase mode
  onPurchaseToggle(purchase: Purchase, event: any) {
    const selected = event.checked;
    if (selected) {
      // Validate: all purchases must belong to same supplier
      if (this.selectedPurchases.length > 0) {
        const firstSupplierId = this.selectedPurchases[0].supplier?.supplierId;
        if (purchase.supplier?.supplierId !== firstSupplierId) {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('all_purchases_must_belong_to_same_supplier'),
            life: 3000
          });
          // Reset checkbox
          (purchase as any).selected = false;
          return;
        }
      }
      this.selectedPurchases.push(purchase);
      // Auto-allocate full outstanding balance
      const outstanding = this.getPurchaseOutstanding(purchase);
      this.purchaseAllocations.set(purchase.purchaseId!, outstanding);
    } else {
      this.selectedPurchases = this.selectedPurchases.filter(p => p.purchaseId !== purchase.purchaseId);
      this.purchaseAllocations.delete(purchase.purchaseId!);
      (purchase as any).selected = false;
    }
    this.updatePaymentAmountFromAllocations();
  }

  // ⚠️ NEW: Update allocation amount for a purchase
  onAllocationChange(purchaseId: number, event: any) {
    const amount = event.value || 0;
    const purchase = this.selectedPurchases.find(p => p.purchaseId === purchaseId);
    if (!purchase) return;

    const outstanding = this.getPurchaseOutstanding(purchase);
    // Validate: allocation cannot exceed outstanding
    if (amount > outstanding) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('allocation_cannot_exceed_outstanding', {
          outstanding: outstanding.toFixed(2)
        }),
        life: 3000
      });
      this.purchaseAllocations.set(purchaseId, outstanding);
      return;
    }

    // Validate: allocation must be positive
    if (amount < 0) {
      this.purchaseAllocations.set(purchaseId, 0);
      return;
    }

    this.purchaseAllocations.set(purchaseId, amount);
    this.updatePaymentAmountFromAllocations();
  }

  // ⚠️ NEW: Calculate total allocated amount
  calculateTotalAllocated(): number {
    return Array.from(this.purchaseAllocations.values())
      .reduce((sum, amount) => sum + amount, 0);
  }

  // ⚠️ NEW: Update payment amount from allocations
  updatePaymentAmountFromAllocations() {
    const total = this.calculateTotalAllocated();
    this.payment.amount = total;
  }

  // ⚠️ NEW: Auto-allocate payment amount proportionally
  autoAllocateProportionally() {
    if (this.selectedPurchases.length === 0) return;

    const totalOutstanding = this.selectedPurchases.reduce((sum, purchase) => {
      return sum + this.getPurchaseOutstanding(purchase);
    }, 0);

    if (totalOutstanding === 0) return;

    const paymentAmount = this.payment.amount || 0;
    const ratio = paymentAmount / totalOutstanding;

    this.selectedPurchases.forEach(purchase => {
      const outstanding = this.getPurchaseOutstanding(purchase);
      const allocated = Math.min(outstanding, outstanding * ratio);
      this.purchaseAllocations.set(purchase.purchaseId!, allocated);
    });

    // Adjust for rounding differences
    const totalAllocated = this.calculateTotalAllocated();
    const difference = paymentAmount - totalAllocated;
    if (Math.abs(difference) > 0.01 && this.selectedPurchases.length > 0) {
      // Add difference to first purchase (if possible)
      const firstPurchase = this.selectedPurchases[0];
      const currentAllocation = this.purchaseAllocations.get(firstPurchase.purchaseId!) || 0;
      const outstanding = this.getPurchaseOutstanding(firstPurchase);
      const newAllocation = Math.min(outstanding, currentAllocation + difference);
      this.purchaseAllocations.set(firstPurchase.purchaseId!, newAllocation);
    }
  }

  // ⚠️ NEW: Allocate full outstanding for all selected purchases
  allocateFullOutstanding() {
    this.selectedPurchases.forEach(purchase => {
      const outstanding = this.getPurchaseOutstanding(purchase);
      this.purchaseAllocations.set(purchase.purchaseId!, outstanding);
    });
    this.updatePaymentAmountFromAllocations();
  }

  // ⚠️ NEW: Select all unpaid purchases
  selectAllUnpaidPurchases() {
    if (!this.payment.supplier) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_select_supplier_first'),
        life: 3000
      });
      return;
    }

    const supplierId = this.payment.supplier.supplierId;
    this.unpaidPurchases.forEach(purchase => {
      if (purchase.supplier?.supplierId === supplierId && !this.isPurchaseSelected(purchase.purchaseId!)) {
        this.onPurchaseToggle(purchase, { checked: true });
      }
    });
  }

  // ⚠️ NEW: Check if purchase is selected in multi-purchase mode
  isPurchaseSelected(purchaseId: number): boolean {
    return this.selectedPurchases.some(p => p.purchaseId === purchaseId);
  }

  // ⚠️ NEW: Get allocation amount for a purchase (for template binding)
  getAllocationAmount(purchaseId: number): number {
    return this.purchaseAllocations.get(purchaseId) || 0;
  }

  // ⚠️ NEW: Set allocation amount for a purchase (for template binding)
  setAllocationAmount(purchaseId: number, amount: number) {
    this.onAllocationChange(purchaseId, { value: amount });
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
      let allFilteredPayments: any[] = [];
      let currentPage = 0;
      const pageSize = 1000;
      let hasMorePages = true;
      const maxPages = 100;

      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent || {};
      const sortBy = sortField || 'paymentDate';
      const direction = sortOrder === 1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...this.currentFilters };

      this.paymentService.loadToken();

      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;

        const response: any = await firstValueFrom(
          this.paymentService.getPayments(
            'outgoing',
            currentPage,
            pageSize,
            globalFilter || '',
            sortBy,
            direction,
            filterPayload
          )
        );

        const pageContent = response.page?.content || response.content || [];
        allFilteredPayments = allFilteredPayments.concat(pageContent);

        const totalElements = response.page?.totalElements || response.totalElements || 0;
        hasMorePages = allFilteredPayments.length < totalElements && pageContent.length > 0;
        currentPage++;
      }

      if (allFilteredPayments.length === 0) {
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
        { title: this.translate.instant('payment_transaction_id'), dataKey: 'transactionId' },
        { title: this.translate.instant('purchase_reference'), dataKey: 'purchaseReference' },
        { title: this.translate.instant('supplier'), dataKey: 'supplierName' },
        { title: this.translate.instant('amount'), dataKey: 'amount' },
        { title: this.translate.instant('payment_status'), dataKey: 'paymentStatus' },
        { title: this.translate.instant('payment_method'), dataKey: 'paymentMethod' },
        { title: this.translate.instant('payment_date'), dataKey: 'paymentDate' }
      ];

      const pdfTitle = this.translate.instant('purchase_payments') || this.translate.instant('outgoing_payments');

      const exportData = allFilteredPayments.map(payment => {
        const exportItem: any = {
          transactionId: payment.transactionId || 'N/A',
          purchaseReference: payment.purchaseReference || 'N/A',
          supplierName: payment.supplierName || 'N/A',
          amount: payment.amount || 0,
          paymentStatus: payment.paymentStatus ? this.translate.instant(`payment_status_${payment.paymentStatus.toLowerCase()}`) : 'N/A',
          paymentMethod: payment.paymentMethod ? this.translate.instant(getPaymentMethodLabel(payment.paymentMethod)) : 'N/A',
          paymentDate: payment.paymentDate ? this.datePipe.transform(payment.paymentDate, 'dd/MM/yyyy') : 'N/A'
        };
        return exportItem;
      });

      this.reportingService.exportPdf(exportColumns, exportData, 'purchase-payments', pdfTitle);
      this.translate.use(currentLang);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredPayments.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting purchase payments PDF:', error);
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
      let allFilteredPayments: any[] = [];
      let currentPage = 0;
      const pageSize = 1000;
      let hasMorePages = true;
      const maxPages = 100;

      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent || {};
      const sortBy = sortField || 'paymentDate';
      const direction = sortOrder === 1 ? 'ASC' : 'DESC';
      const filterPayload: any = { ...this.currentFilters };

      this.paymentService.loadToken();

      while (hasMorePages && currentPage < maxPages) {
        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1}...)` || `Fetching data... (${currentPage + 1}...)`;

        const response: any = await firstValueFrom(
          this.paymentService.getPayments(
            'outgoing',
            currentPage,
            pageSize,
            globalFilter || '',
            sortBy,
            direction,
            filterPayload
          )
        );

        const pageContent = response.page?.content || response.content || [];
        allFilteredPayments = allFilteredPayments.concat(pageContent);

        const totalElements = response.page?.totalElements || response.totalElements || 0;
        hasMorePages = allFilteredPayments.length < totalElements && pageContent.length > 0;
        currentPage++;
      }

      if (allFilteredPayments.length === 0) {
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

      const translatedPayments = allFilteredPayments.map(payment => {
        const translated: any = {
          [this.translate.instant('payment_transaction_id')]: payment.transactionId || 'N/A',
          [this.translate.instant('purchase_reference')]: payment.purchaseReference || 'N/A',
          [this.translate.instant('supplier')]: payment.supplierName || 'N/A',
          [this.translate.instant('amount')]: payment.amount || 0,
          [this.translate.instant('payment_status')]: payment.paymentStatus ? this.translate.instant(`payment_status_${payment.paymentStatus.toLowerCase()}`) : 'N/A',
          [this.translate.instant('payment_method')]: payment.paymentMethod ? this.translate.instant(getPaymentMethodLabel(payment.paymentMethod)) : 'N/A',
          [this.translate.instant('payment_date')]: payment.paymentDate ? this.datePipe.transform(payment.paymentDate, 'dd/MM/yyyy') : 'N/A'
        };
        return translated;
      });

      this.reportingService.exportExcel(translatedPayments, 'purchase-payments');
      this.translate.use(currentLang);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredPayments.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting purchase payments Excel:', error);
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

  getSupplierDisplayName(supplier: any): string {
    if (!supplier) return 'N/A';
    return supplier.name || 'Unnamed Supplier';
  }

  getPaymentStatusSeverity(status: string): string {
    return getPaymentStatusSeverity(status);
  }

  getPaymentStatusIcon(status: string): string {
    return getPaymentStatusIcon(status);
  }

  getReceiptStatusSeverity(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ISSUED': return 'success';
      case 'PENDING': return 'warning';
      case 'CANCELLED': return 'danger';
      default: return 'info';
    }
  }

  getReceiptStatusIcon(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ISSUED': return 'pi pi-check';
      case 'PENDING': return 'pi pi-clock';
      case 'CANCELLED': return 'pi pi-times';
      default: return 'pi pi-file';
    }
  }

  getPaymentMethodIcon(method: string): string {
    return getPaymentMethodIcon(method);
  }

  getPaymentMethodSeverity(method: string): string {
    return getPaymentMethodSeverity(method);
  }

  getPaymentMethodLabel(paymentMethod: string) {
    return getPaymentMethodLabel(paymentMethod);
  }

  viewReceipt(payment: any) {
    this.paymentService.getReceipt(payment.paymentId).subscribe({
      next: (blob: Blob) => {
        const fileURL = URL.createObjectURL(blob);
        window.open(fileURL, '_blank');
      },
      error: (err) => {
        console.error('Error fetching receipt:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_fetching_receipt'),
        });
      }
    });
  }

  printReceipt(docNumber: any): void {
    this.financialDocService.printFinancialDoc(docNumber);
  }

  generateReceipt(paymentId) {
    this.financialDocService.generateReceiptFromPOS(paymentId).subscribe({
      next: (res: any) => {
        // Reuse the existing logic to open the PDF
        this.financialDocService.printFinancialDoc(res.number);

        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('receipt_generated'),
          detail: res.number,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('receipt_generation_failed'),
        });
      }

    });
  }

  requiresReconciliation(paymentMethod: string | null | undefined): boolean {
    return this.reconciliationValidationService.requiresReconciliation(paymentMethod);
  }

  canConfirmPaymentBasedOnReconciliation(payment: Payment): boolean {
    if (!payment.paymentId || !this.requiresReconciliation(payment.paymentMethod)) {
      return true; // No reconciliation required
    }
    
    const status = this.paymentReconciliationCache.get(payment.paymentId);
    return !status || status.canProceed;
  }

}

