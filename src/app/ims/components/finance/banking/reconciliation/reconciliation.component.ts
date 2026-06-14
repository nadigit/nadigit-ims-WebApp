import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BankAccount } from 'src/app/models/bank-account';
import { BankTransaction, TransactionFilter } from 'src/app/models/bank-transaction';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { PaymentService } from 'src/app/services/payment.service';
import { Payment } from 'src/app/models/payment';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { firstValueFrom } from 'rxjs';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

@Component({
  templateUrl: './reconciliation.component.html',
  styleUrls: ['./reconciliation.component.css', '../../finance.component.css'],
  providers: [MessageService]
})
export class ReconciliationComponent implements OnInit {
  readonly TablePageSizeKeys = TablePageSizeKeys;
  readonly reconciliationPageOptions = [10, 20, 50] as const;

  accountId!: number;
  account: BankAccount | null = null;
  unreconciledTransactions: BankTransaction[] = [];
  selectedTransactions: BankTransaction[] = [];
  paymentCache: Map<number, Payment> = new Map(); // Cache for payment details
  confirmingPayments: Set<number> = new Set(); // Track payments being confirmed

  isLoading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private bankAccountService: BankAccountService,
    private paymentService: PaymentService,
    private translate: TranslateService,
    private translateService: TranslationService,
    public pageSizeService: TablePageSizeService
  ) { }

  async ngOnInit() {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.accountId = +params['accountId'];
      await this.loadAccount();
      await this.loadUnreconciledTransactions();
      this.isLoading = false;
    });
  }

  async loadAccount() {
    try {
      const response = await firstValueFrom(await this.bankAccountService.getBankAccount(this.accountId));
      this.account = response;
    } catch (error) {
      console.error('Error loading account:', error);
      this.router.navigate(['/finance/banking/accounts']);
    }
  }

  async loadUnreconciledTransactions() {
    try {
      const filter: TransactionFilter = {
        reconciled: false,
        page: 0,
        size: 200,
        sortBy: 'transactionDate',
        sortDirection: 'desc'
      };
      const response = await firstValueFrom(
        await this.bankAccountService.getTransactions(this.accountId, filter)
      );
      this.unreconciledTransactions = response.content || [];
      
      // Load payment details for transactions with linked payments
      await this.loadPaymentDetailsForTransactions();
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }

  /**
   * Load payment details for all transactions that have a linked payment
   */
  async loadPaymentDetailsForTransactions() {
    const paymentIds = new Set<number>();
    
    // Collect all unique payment IDs
    this.unreconciledTransactions.forEach(transaction => {
      if (transaction.payment?.paymentId) {
        paymentIds.add(transaction.payment.paymentId);
      }
    });

    // Load payment details for each unique payment ID
    const loadPromises = Array.from(paymentIds).map(paymentId => 
      this.loadPaymentDetails(paymentId).catch(error => {
        console.error(`Error loading payment ${paymentId}:`, error);
        return null;
      })
    );

    await Promise.all(loadPromises);
  }

  async reconcileSelected() {
    if (this.selectedTransactions.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('select_transactions_to_reconcile'),
        life: 3000
      });
      return;
    }

    try {
      const transactionIds = this.selectedTransactions.map(t => t.transactionId!);
      await firstValueFrom(await this.bankAccountService.reconcileBatch(transactionIds));
      
      // After reconciliation, check for pending payments that can be confirmed
      const transactionsWithPayments = this.selectedTransactions.filter(t => t.payment?.paymentId);
      if (transactionsWithPayments.length > 0) {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('transactions_reconciled') + '. ' + this.translate.instant('pending_payments_available_for_confirmation'),
          life: 5000
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('transactions_reconciled'),
          life: 3000
        });
      }
      
      this.selectedTransactions = [];
      await this.loadUnreconciledTransactions();
    } catch (error) {
      console.error('Error reconciling transactions:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_reconciling_transactions'),
        life: 3000
      });
    }
  }

  async reconcileAll() {
    if (this.unreconciledTransactions.length === 0) {
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('info'),
        detail: this.translate.instant('no_unreconciled_transactions'),
        life: 3000
      });
      return;
    }

    try {
      const transactionIds = this.unreconciledTransactions.map(t => t.transactionId!);
      await firstValueFrom(await this.bankAccountService.reconcileBatch(transactionIds));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('all_transactions_reconciled'),
        life: 3000
      });
      await this.loadUnreconciledTransactions();
    } catch (error) {
      console.error('Error reconciling transactions:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_reconciling_transactions'),
        life: 3000
      });
    }
  }

  formatBalance(balance: number, currency?: string): string {
    const curr = currency || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(balance);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
  }

  cancel() {
    this.router.navigate(['/finance/banking/accounts', this.accountId]);
  }

  /**
   * Check if transaction has a linked payment
   */
  hasPayment(transaction: BankTransaction): boolean {
    return !!transaction.payment?.paymentId;
  }

  /**
   * Get payment ID from transaction
   */
  getPaymentId(transaction: BankTransaction): number | null {
    return transaction.payment?.paymentId || null;
  }

  /**
   * Load payment details for a transaction
   */
  async loadPaymentDetails(paymentId: number): Promise<Payment | null> {
    if (this.paymentCache.has(paymentId)) {
      return this.paymentCache.get(paymentId) || null;
    }

    try {
      const payment = await firstValueFrom(this.paymentService.getPayment(paymentId));
      this.paymentCache.set(paymentId, payment);
      return payment;
    } catch (error) {
      console.error('Error loading payment details:', error);
      return null;
    }
  }

  /**
   * Check if payment is pending and can be confirmed
   */
  isPaymentPending(payment: Payment | null): boolean {
    return payment?.paymentStatus === 'PENDING';
  }

  /**
   * Get payment status for a transaction (safe method for template)
   */
  getPaymentStatus(transaction: BankTransaction): string | null {
    const paymentId = this.getPaymentId(transaction);
    if (!paymentId) {
      return null;
    }
    const payment = this.paymentCache.get(paymentId);
    return payment?.paymentStatus || null;
  }

  /**
   * Check if payment status is PENDING (safe method for template)
   */
  isPaymentStatusPending(transaction: BankTransaction): boolean {
    return this.getPaymentStatus(transaction) === 'PENDING';
  }

  /**
   * Check if payment status is CONFIRMED (safe method for template)
   */
  isPaymentStatusConfirmed(transaction: BankTransaction): boolean {
    return this.getPaymentStatus(transaction) === 'CONFIRMED';
  }

  /**
   * Confirm a payment after reconciliation
   */
  async confirmPayment(transaction: BankTransaction) {
    const paymentId = this.getPaymentId(transaction);
    if (!paymentId) {
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm(this.translate.instant('confirm_payment_after_reconciliation'));
    if (!confirmed) {
      return;
    }

    this.confirmingPayments.add(paymentId);

    try {
      await firstValueFrom(this.paymentService.confirmPayment(paymentId));
      
      // Update cached payment status
      const payment = this.paymentCache.get(paymentId);
      if (payment) {
        payment.paymentStatus = 'CONFIRMED';
        this.paymentCache.set(paymentId, payment);
      }

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('payment_confirmed_successfully'),
        life: 3000
      });
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_confirming_payment') + ': ' + (error.message || ''),
        life: 4000
      });
    } finally {
      this.confirmingPayments.delete(paymentId);
    }
  }

  /**
   * Check if payment is currently being confirmed
   */
  isConfirmingPayment(paymentId: number | null): boolean {
    return paymentId ? this.confirmingPayments.has(paymentId) : false;
  }

  /**
   * Navigate to payment details
   */
  viewPayment(paymentId: number) {
    this.router.navigate(['/finance/payments'], { queryParams: { paymentId } });
  }
}

