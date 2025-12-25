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

@Component({
  selector: 'app-sales-payment-details-page',
  templateUrl: './sales-payment-details-page.component.html',
  styleUrls: ['./sales-payment-details-page.component.css', '../payments.component.css']
})
export class SalesPaymentDetailsPageComponent implements OnInit {
  paymentId!: number;
  payment: Payment | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  canRead: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "PAYMENTS";

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
    public financialDocService: FinancialDocumentsService
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

      // Load order details if orderId exists
      if (this.payment.orderId) {
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
    if (!this.payment?.order?.totalAmount || !this.payment?.order?.totalPaid) return 0;
    return this.payment.order.totalAmount - this.payment.order.totalPaid;
  }

  isPaymentNotSettled(): boolean {
    if (!this.payment?.paymentDate) return false;
    
    const today = new Date();
    const paymentDate = new Date(this.payment.paymentDate);

    const isToday =
      paymentDate.getFullYear() === today.getFullYear() &&
      paymentDate.getMonth() === today.getMonth() &&
      paymentDate.getDate() === today.getDate();

    return isToday && this.payment.paymentStatus !== 'SETTLED';
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
}

