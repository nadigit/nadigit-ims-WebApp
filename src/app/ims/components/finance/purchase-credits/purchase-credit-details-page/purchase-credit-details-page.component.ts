import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { PurchaseCredit } from 'src/app/models/purchaseCredit';
import { PurchaseCreditService } from 'src/app/services/purchase-credit.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { firstValueFrom } from 'rxjs';
import { getPaymentMethodIcon, getPaymentMethodSeverity } from 'src/app/shared/payment-utils';

@Component({
  selector: 'app-purchase-credit-details-page',
  templateUrl: './purchase-credit-details-page.component.html',
  styleUrls: ['./purchase-credit-details-page.component.css', '../purchase-credits.component.css', '../../finance.component.css']
})
export class PurchaseCreditDetailsPageComponent implements OnInit {
  creditId!: number;
  credit: PurchaseCredit | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  creditEvents: any[] = [];
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  canRead: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "PURCHASE_CREDITS";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private purchaseCreditService: PurchaseCreditService,
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
    this.purchaseCreditService.loadToken();
    
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.creditId = +params['id'];
      if (!this.creditId || isNaN(this.creditId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_credit_id'),
          life: 3000
        });
        this.router.navigate(['/finance/purchase-credits']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadCredit();
    });
  }

  async loadCredit(): Promise<void> {
    try {
      // Ensure token is loaded
      this.purchaseCreditService.loadToken();
      
      const response = await firstValueFrom(this.purchaseCreditService.getCreditById(this.creditId));
      console.log('Purchase Credit API response:', response);
      
      // Handle different response formats
      let creditData: any;
      if (Array.isArray(response)) {
        creditData = response[0];
      } else if (response && typeof response === 'object') {
        creditData = response;
      } else {
        throw new Error('Unexpected response format from API');
      }
      
      // Normalize creditId if needed (handle both creditId and purchaseCreditId)
      if (creditData.purchaseCreditId && !creditData.creditId) {
        creditData.creditId = creditData.purchaseCreditId;
      }
      
      this.credit = creditData as PurchaseCredit;
      
      if (!this.credit || !this.credit.creditId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('credit_not_found'),
          life: 3000
        });
        this.router.navigate(['/finance/purchase-credits']);
        return;
      }

      this.generateCreditEvents();
      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading purchase credit:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_credit') || 'Error loading credit',
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

  generateCreditEvents() {
    if (!this.credit) return;
    
    this.creditEvents = [
      {
        status: 'Initiated',
        date: this.credit?.creationDate,
        icon: 'pi pi-plus-circle',
        button: 'Process Credit'
      },
      {
        status: 'Processing',
        date: this.credit?.processingDate,
        icon: 'pi pi-spinner',
        button: 'Complete Credit'
      },
      {
        status: 'Completed',
        date: this.credit?.creditDate,
        icon: 'pi pi-check-circle',
        button: null
      }
    ].filter(event => event.date != null || event.status === 'Initiated');
  }

  getCreditStatusSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'Initiated': 'info',
      'Processing': 'warning',
      'Completed': 'success',
      'Failed': 'danger',
      'Canceled': 'secondary'
    };
    return severityMap[status] || 'info';
  }

  getCreditStatusSeverityTag(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    const severityMap: { [key: string]: 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined } = {
      'Initiated': 'info',
      'Processing': 'warn',
      'Completed': 'success',
      'Failed': 'danger',
      'Canceled': 'secondary'
    };
    return severityMap[status] || 'info';
  }

  getCreditStatusIcon(status: string): string {
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
    return this.credit?.status?.toLowerCase() === status?.toLowerCase();
  }

  printCredit(): void {
    console.log('Print credit:', this.credit);
    // Implement print functionality
  }

  exportCreditToPDF(): void {
    console.log('Export credit to PDF:', this.credit);
    // Implement PDF export functionality
  }

  hasCreditMethodDetails(): boolean {
    return !!(this.credit?.checkNumber || this.credit?.boeNumber ||
      this.credit?.checkExpirationDate ||
      this.credit?.boeExpirationDate);
  }

  getSupplierDisplayName(supplier: any): string {
    if (!supplier) return 'N/A';
    return supplier.name || supplier.supplierName || 'N/A';
  }

  isCreditValidForUpdate(): boolean {
    if (!this.credit) return false;
    return this.credit.status === 'Initiated' || this.credit.status === 'Processing';
  }

  viewPurchase(purchaseId: number): void {
    if (!purchaseId) return;
    this.router.navigate(['/inventory/purchases', purchaseId]);
  }

  viewPurchaseReturn(returnId: number): void {
    if (!returnId) return;
    // Handle both returnId and purchaseReturnId
    this.router.navigate(['/inventory/purchase-returns', returnId]);
  }

  deleteCredit(): void {
    if (!this.canDelete || !this.credit) return;
    
    // This would typically open a confirmation dialog
    // For now, we'll just show a message
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: this.translate.instant('delete_credit_confirmation_required'),
      life: 3000
    });
  }

  editCredit(): void {
    if (!this.canEdit || !this.credit) return;
    
    // Navigate to edit or show edit dialog
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: this.translate.instant('edit_credit_functionality'),
      life: 3000
    });
  }
}

