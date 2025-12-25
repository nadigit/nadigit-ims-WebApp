import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Refund } from 'src/app/models/refund';
import { RefundService } from 'src/app/services/refund.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { firstValueFrom } from 'rxjs';
import { getPaymentMethodIcon, getPaymentMethodSeverity } from 'src/app/shared/payment-utils';

@Component({
  selector: 'app-refund-details-page',
  templateUrl: './refund-details-page.component.html',
  styleUrls: ['./refund-details-page.component.css', '../refunds.component.css', '../../finance.component.css']
})
export class RefundDetailsPageComponent implements OnInit {
  refundId!: number;
  refund: Refund | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  refundEvents: any[] = [];
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  canRead: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "REFUNDS";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private refundService: RefundService,
    private messageService: MessageService,
    private translate: TranslateService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translateService: TranslationService
  ) {}

  async ngOnInit() {
    this.isLoading = true;
    
    // Load token first
    this.refundService.loadToken();
    
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.refundId = +params['id'];
      if (!this.refundId || isNaN(this.refundId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_refund_id'),
          life: 3000
        });
        this.router.navigate(['/finance/refunds']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadRefund();
    });
  }

  async loadRefund(): Promise<void> {
    try {
      // Ensure token is loaded
      this.refundService.loadToken();
      
      const response = await firstValueFrom(this.refundService.getRefund(this.refundId));
      console.log('Refund API response:', response);
      
      // Handle different response formats
      if (Array.isArray(response)) {
        this.refund = response[0] as Refund;
      } else if (response && typeof response === 'object') {
        this.refund = response as Refund;
      } else {
        throw new Error('Unexpected response format from API');
      }
      
      if (!this.refund || !this.refund.refundId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('refund_not_found'),
          life: 3000
        });
        this.router.navigate(['/finance/refunds']);
        return;
      }

      this.generateRefundEvents();
      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading refund:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_refund') || 'Error loading refund',
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

  generateRefundEvents() {
    if (!this.refund) return;
    
    this.refundEvents = [
      {
        status: 'Initiated',
        date: this.refund?.creationDate,
        icon: 'pi pi-plus-circle',
        button: 'Process Refund'
      },
      {
        status: 'Processing',
        date: this.refund?.processingDate,
        icon: 'pi pi-spinner',
        button: 'Complete Refund'
      },
      {
        status: 'Completed',
        date: this.refund?.refundDate,
        icon: 'pi pi-check-circle',
        button: null
      }
    ].filter(event => event.date != null || event.status === 'Initiated');
  }

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

  getRefundStatusSeverityTag(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    const severityMap: { [key: string]: 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined } = {
      'Initiated': 'info',
      'Processing': 'warn',
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

  getPaymentMethodSeverity(method: string): string {
    return getPaymentMethodSeverity(method);
  }

  getPaymentMethodIcon(method: string): string {
    return getPaymentMethodIcon(method);
  }

  getPaymentMethodSeverityTag(method: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    const severityMap: { [key: string]: 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined } = {
      'Cash': 'success',
      'Card': 'info',
      'Transfer': 'secondary',
      'Check': 'warn',
      'BOE': 'contrast'
    };
    return severityMap[method] || 'secondary';
  }

  isCurrentStatus(status: string): boolean {
    return this.refund?.status?.toLowerCase() === status?.toLowerCase();
  }

  printRefund(): void {
    console.log('Print refund:', this.refund);
    // Implement print functionality
  }

  exportRefundToPDF(): void {
    console.log('Export refund to PDF:', this.refund);
    // Implement PDF export functionality
  }

  hasRefundMethodDetails(): boolean {
    return !!(this.refund?.checkNumber || this.refund?.boeNumber ||
      this.refund?.checkExpirationDate ||
      this.refund?.boeExpirationDate);
  }

  getCustomerDisplayName(customer: any): string {
    if (!customer) return 'N/A';
    
    if (customer.companyName) {
      return customer.companyName;
    }
    
    const firstName = customer.firstName || '';
    const lastName = customer.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    return fullName || 'N/A';
  }

  isRefundValidForUpdate(): boolean {
    if (!this.refund) return false;
    return this.refund.status === 'Initiated' || this.refund.status === 'Processing';
  }

  viewOrder(orderId: number): void {
    if (!orderId) return;
    this.router.navigate(['/sales/orders', orderId]);
  }

  viewReturn(returnId: number): void {
    if (!returnId) return;
    this.router.navigate(['/sales/returns', returnId]);
  }

  deleteRefund(): void {
    if (!this.canDelete || !this.refund) return;
    
    // This would typically open a confirmation dialog
    // For now, we'll just show a message
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: this.translate.instant('delete_refund_confirmation_required'),
      life: 3000
    });
  }

  editRefund(): void {
    if (!this.canEdit || !this.refund) return;
    
    // Navigate to edit or show edit dialog
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: this.translate.instant('edit_refund_functionality'),
      life: 3000
    });
  }
}

