import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Payment } from 'src/app/models/payment';
import { PaymentService } from 'src/app/services/payment.service';
import { OrderService } from 'src/app/services/order.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { Order } from 'src/app/models/order';
import { firstValueFrom } from 'rxjs';
import { getPaymentMethodIcon, getPaymentMethodSeverity, getPaymentStatusSeverity, getPaymentStatusIcon } from 'src/app/shared/payment-utils';
import { ReconciliationValidationService, ReconciliationStatus } from 'src/app/services/reconciliation-validation.service';

@Component({
  selector: 'app-sales-payment-details-page',
  templateUrl: './sales-payment-details-page.component.html',
  styleUrls: ['./sales-payment-details-page.component.css']
})
export class SalesPaymentDetailsPageComponent implements OnInit {
  paymentId!: number;
  payment: Payment | null = null;
  payments: Payment[] = []; // All payments in the transaction
  isLoading: boolean = true;
  currency: string = 'USD';
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  canRead: boolean = false;
  canConfirm: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "PAYMENTS";
  
  // Reconciliation status properties
  reconciliationStatus: ReconciliationStatus | null = null;
  isCheckingReconciliation: boolean = false;
  confirmPaymentDialog: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private paymentService: PaymentService,
    private orderService: OrderService,
    private messageService: MessageService,
    private translate: TranslateService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translateService: TranslationService,
    public financialDocService: FinancialDocumentsService,
    private reconciliationValidationService: ReconciliationValidationService
  ) {}

  async ngOnInit() {
    this.isLoading = true;
    
    // Load token first
    this.paymentService.loadToken();
    
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.paymentId = +params['id'];
      if (!this.paymentId || isNaN(this.paymentId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_payment_id'),
          life: 3000
        });
        this.router.navigate(['/finance/payments/sales']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadPayment();
    });
  }

  async loadPayment(): Promise<void> {
    try {
      // Ensure token is loaded
      this.paymentService.loadToken();
      
      const response = await firstValueFrom(this.paymentService.getPayment(this.paymentId));
      console.log('Payment API response:', response);
      
      // Handle different response formats
      if (Array.isArray(response)) {
        this.payment = response[0] as Payment;
      } else if (response && typeof response === 'object') {
        this.payment = response as Payment;
      } else {
        throw new Error('Unexpected response format from API');
      }
      
      if (!this.payment || !this.payment.paymentId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('payment_not_found'),
          life: 3000
        });
        this.router.navigate(['/finance/payments/sales']);
        return;
      }

      // Load all payments with the same transaction ID if it exists
      if (this.payment.transactionId) {
        try {
          const transactionPayments = await firstValueFrom(
            this.paymentService.getPaymentsByTransactionId(this.payment.transactionId)
          );
          if (Array.isArray(transactionPayments) && transactionPayments.length > 0) {
            this.payments = transactionPayments;
            // Load order details for all payments in the transaction
            for (const payment of this.payments) {
              if (payment.orderId && !payment.order) {
                try {
                  const order = await firstValueFrom(this.orderService.getOrder(payment.orderId));
                  if (Array.isArray(order)) {
                    payment.order = order[0] as Order;
                  } else {
                    payment.order = order as Order;
                  }
                } catch (error) {
                  console.error('Error loading order:', error);
                }
              }
            }
          } else {
            // No other payments found (404) - this is fine, use only the current payment
            this.payments = [this.payment];
          }
        } catch (error: any) {
          console.error('Error loading payments by transaction ID:', error);
          const errorMessage = error?.message || 'Unknown error';
          
          // Handle specific error cases
          if (errorMessage.includes('Invalid transaction ID')) {
            this.messageService.add({
              severity: 'warn',
              summary: this.translate.instant('warning'),
              detail: this.translate.instant('invalid_transaction_id'),
              life: 4000
            });
          } else if (errorMessage.includes('Unauthorized')) {
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: this.translate.instant('unauthorized_access'),
              life: 4000
            });
          }
          
          // Fallback: only the current payment
          this.payments = [this.payment];
        }
      } else {
        // No transaction ID, only the current payment
        this.payments = [this.payment];
      }

      // Load order details for the main payment if orderId exists
      if (this.payment.orderId && !this.payment.order) {
        try {
          const order = await firstValueFrom(this.orderService.getOrder(this.payment.orderId));
          if (Array.isArray(order)) {
            this.payment.order = order[0] as Order;
          } else {
            this.payment.order = order as Order;
          }
        } catch (error) {
          console.error('Error loading order:', error);
        }
      }

      // Load reconciliation status if required
      if (this.payment.paymentId && this.reconciliationValidationService.requiresReconciliation(this.payment.paymentMethod)) {
        this.isCheckingReconciliation = true;
        try {
          this.reconciliationStatus = await this.reconciliationValidationService.checkPaymentReconciliationStatus(this.payment.paymentId);
          this.isCheckingReconciliation = false;
        } catch (error) {
          console.error('Error checking reconciliation status:', error);
          this.isCheckingReconciliation = false;
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('error_loading_reconciliation_status'),
            life: 4000
          });
          this.reconciliationStatus = null;
        }
      } else {
        this.reconciliationStatus = null;
        this.isCheckingReconciliation = false;
      }

      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading payment:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_payment') || 'Error loading payment',
        life: 3000
      });
      this.isLoading = false;
    }
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canEdit = this.permissionService.canUpdate(this.Ressource);
    this.canDelete = this.permissionService.canDelete(this.Ressource);
    this.canRead = this.permissionService.canRead(this.Ressource);
    // Note: confirm permission might need to be added to permission service
    // For now, allowing if user can update
    this.canConfirm = this.permissionService.canUpdate(this.Ressource);
  }

  async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  goBack(): void {
    this.location.back();
  }

  getPaymentMethodIcon(method: string): string {
    return getPaymentMethodIcon(method);
  }

  getPaymentMethodSeverity(method: string): string {
    return getPaymentMethodSeverity(method);
  }

  getPaymentStatusSeverity(status: string): string {
    return getPaymentStatusSeverity(status);
  }

  getPaymentStatusIcon(status: string): string {
    return getPaymentStatusIcon(status);
  }

  hasPaymentMethodDetails(): boolean {
    return !!(this.payment?.checkNumber || this.payment?.boeNumber ||
      this.payment?.checkExpirationDate ||
      this.payment?.boeExpirationDate);
  }

  getRemainingBalance(): number {
    if (this.hasMultipleOrders()) {
      // Calculate total remaining balance across all orders
      return this.getTotalOrderAmount() - this.getTotalOrderPaid();
    }
    if (!this.payment?.order?.totalAmount || !this.payment?.order?.totalPaid) return 0;
    return this.payment.order.totalAmount - this.payment.order.totalPaid;
  }

  getTotalOrderAmount(): number {
    if (this.hasMultipleOrders()) {
      return this.getOrdersInTransaction().reduce((sum, p) => {
        return sum + (p.order?.totalAmount || 0);
      }, 0);
    }
    return this.payment?.order?.totalAmount || 0;
  }

  getTotalOrderPaid(): number {
    if (this.hasMultipleOrders()) {
      return this.getOrdersInTransaction().reduce((sum, p) => {
        return sum + (p.order?.totalPaid || 0);
      }, 0);
    }
    return this.payment?.order?.totalPaid || 0;
  }

  getTotalPaymentAmount(): number {
    if (this.hasMultipleOrders()) {
      return this.getTotalAmountForTransaction();
    }
    return this.payment?.amount || 0;
  }

  getTotalCreditUsed(): number {
    if (this.hasMultipleOrders()) {
      return this.payments.reduce((sum, p) => sum + (p.creditAmountUsed || 0), 0);
    }
    return this.payment?.creditAmountUsed || 0;
  }

  isPaymentNotSettled(): boolean {
    // A payment is considered "not settled" if its status is not SETTLED
    // This allows editing/deleting payments regardless of when they were created,
    // as long as they haven't been settled yet
    if (!this.payment) return false;
    return this.payment.paymentStatus !== 'SETTLED';
  }

  getReceiptStatusSeverity(status: string): string {
    switch (status?.toLowerCase()) {
      case 'generated': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'danger';
      default: return 'info';
    }
  }

  getPaymentStatusSeverityTag(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | undefined {
    switch (status?.toLowerCase()) {
      case 'completed': return 'success';
      case 'settled': return 'success';
      case 'pending': return 'warn';
      case 'failed': return 'danger';
      case 'cancelled': return 'danger';
      default: return 'info';
    }
  }

  getPaymentMethodSeverityTag(method: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | undefined {
    switch (method?.toLowerCase()) {
      case 'cash': return 'success';
      case 'card': return 'info';
      case 'transfer': return 'info';
      case 'check': return 'warn';
      case 'boe': return 'warn';
      default: return 'secondary';
    }
  }

  getReceiptStatusSeverityTag(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | undefined {
    switch (status?.toLowerCase()) {
      case 'generated': return 'success';
      case 'pending': return 'warn';
      case 'failed': return 'danger';
      default: return 'info';
    }
  }

  getReceiptStatusIcon(status: string): string {
    switch (status?.toLowerCase()) {
      case 'generated': return 'pi pi-check';
      case 'pending': return 'pi pi-clock';
      case 'failed': return 'pi pi-times';
      default: return 'pi pi-file';
    }
  }

  viewOrder(orderId: number): void {
    if (!orderId) return;
    this.router.navigate(['/sales/orders', orderId]);
  }

  hasMultipleOrders(): boolean {
    return this.payments && this.payments.length > 1 && 
           this.payments.some(p => p.orderId);
  }

  getOrdersInTransaction(): Payment[] {
    return this.payments.filter(p => p.orderId);
  }

  getTotalAmountForTransaction(): number {
    return this.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }

  scrollToPayments(): void {
    // Scroll to payment information section
    const element = document.querySelector('.payment-information');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  printReceipt(receiptNumber: string): void {
    if (!receiptNumber) return;
    this.financialDocService.printFinancialDoc(receiptNumber);
  }

  generateReceipt(paymentId: number): void {
    if (!paymentId) return;
    
    this.financialDocService.generateReceiptFromPOS(paymentId).subscribe({
      next: (res: any) => {
        this.financialDocService.printFinancialDoc(res.number);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('receipt_generated'),
          detail: res.number,
        });
        // Reload payment to get updated receipt info
        this.loadPayment();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('receipt_generation_failed'),
          life: 3000
        });
      }
    });
  }

  deletePayment(): void {
    if (!this.canDelete || !this.payment) return;
    
    // This would typically open a confirmation dialog
    // For now, we'll just show a message
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: this.translate.instant('delete_payment_confirmation_required'),
      life: 3000
    });
  }

  requiresReconciliation(paymentMethod: string | null | undefined): boolean {
    return this.reconciliationValidationService.requiresReconciliation(paymentMethod);
  }

  canConfirmPaymentBasedOnReconciliation(): boolean {
    if (!this.payment?.paymentId || !this.requiresReconciliation(this.payment.paymentMethod)) {
      return true; // No reconciliation required
    }
    return !this.reconciliationStatus || this.reconciliationStatus.canProceed;
  }

  async openConfirmPayment(): Promise<void> {
    if (!this.canConfirm || !this.payment) return;
    this.confirmPaymentDialog = true;
    
    // Check reconciliation status if required
    if (this.payment.paymentId && this.reconciliationValidationService.requiresReconciliation(this.payment.paymentMethod)) {
      try {
        this.isCheckingReconciliation = true;
        this.reconciliationStatus = await this.reconciliationValidationService.checkPaymentReconciliationStatus(this.payment.paymentId);
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
        this.reconciliationStatus = null;
      }
    } else {
      this.reconciliationStatus = null;
    }
  }

  async confirmPayment(): Promise<void> {
    if (!this.payment?.paymentId) return;
    
    // Check reconciliation status before confirming (refresh status to ensure it's current)
    if (this.reconciliationValidationService.requiresReconciliation(this.payment.paymentMethod)) {
      try {
        this.isCheckingReconciliation = true;
        const status = await this.reconciliationValidationService.checkPaymentReconciliationStatus(this.payment.paymentId);
        this.reconciliationStatus = status;
        this.isCheckingReconciliation = false;
        
        if (!status.canProceed) {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('cannot_confirm_payment_reconciliation_required'),
            life: 5000
          });
          return; // Don't confirm
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
        this.reconciliationStatus = null;
        return; // Don't proceed if we can't check status
      }
    }
    
    this.confirmPaymentDialog = false;
    
    try {
      await firstValueFrom(this.paymentService.confirmPayment(this.payment.paymentId));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('payment_confirmed'),
        life: 3000
      });
      // Reload payment to get updated status
      await this.loadPayment();
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      const errorMessage = error?.error?.message || error?.message || '';
      const errorLower = errorMessage.toLowerCase();
      
      if (errorLower.includes('reconciled') || errorLower.includes('reconciliation') || errorLower.includes('bank transaction')) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('cannot_confirm_payment_reconciliation_required'),
          life: 5000
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: errorMessage || this.translate.instant('error_confirming_payment'),
          life: 4000
        });
      }
    }
  }
}

