import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Purchase } from 'src/app/models/purchase';
import { PurchaseService } from 'src/app/services/purchase.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-purchase-details-page',
  templateUrl: './purchase-details-page.component.html',
  styleUrls: ['./purchase-details-page.component.css', '../purchases.component.css']
})
export class PurchaseDetailsPageComponent implements OnInit {
  purchaseId!: number;
  purchase: Purchase | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  canProcess: boolean = false;
  canCancel: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "PURCHASES";

  purchaseEvents: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private purchaseService: PurchaseService,
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
    this.purchaseService.loadToken();
    
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.purchaseId = +params['id'];
      if (!this.purchaseId || isNaN(this.purchaseId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_purchase_id'),
          life: 3000
        });
        this.router.navigate(['/inventory/purchases']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadPurchase();
    });
  }

  async loadPurchase(): Promise<void> {
    try {
      // Ensure token is loaded
      this.purchaseService.loadToken();
      
      const response = await firstValueFrom(this.purchaseService.getPurchase(this.purchaseId));
      console.log('Purchase API response:', response);
      
      // Handle different response formats
      if (Array.isArray(response)) {
        this.purchase = response[0] as Purchase;
      } else if (response && typeof response === 'object') {
        this.purchase = response as Purchase;
      } else {
        throw new Error('Unexpected response format from API');
      }
      
      if (!this.purchase || !this.purchase.purchaseId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('purchase_not_found'),
          life: 3000
        });
        this.router.navigate(['/inventory/purchases']);
        return;
      }

      this.generatePurchaseEvents();
      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading purchase:', error);
      this.isLoading = false;
      const errorMessage = error?.error?.message || error?.message || this.translate.instant('error_loading_purchase');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 3000
      });
      setTimeout(() => {
        this.router.navigate(['/inventory/purchases']);
      }, 2000);
    }
  }

  generatePurchaseEvents() {
    if (!this.purchase) return;
    
    this.purchaseEvents = [
      {
        status: 'PENDING',
        date: this.purchase?.dateOfPurchase,
        icon: 'pi pi-shopping-cart',
        button: 'Process Purchase'
      },
      {
        status: 'APPROVED',
        date: this.purchase?.approvedDate,
        icon: 'pi pi-box',
        button: 'Mark as Received'
      },
      {
        status: 'RECEIVED',
        date: this.purchase?.receivedDate,
        icon: 'pi pi-check-circle',
        button: 'Complete Purchase'
      },
      {
        status: 'COMPLETED',
        date: this.purchase?.completionDate,
        icon: 'pi pi-flag-fill',
        button: null
      }
    ].filter(event => event.date != null || event.status === 'PENDING');
  }

  getPurchaseStatusSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'PENDING': 'info',
      'APPROVED': 'warning',
      'RECEIVED': 'success',
      'COMPLETED': 'success',
      'CANCELED': 'danger'
    };
    return severityMap[status] || 'info';
  }

  getPaymentStatusSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'PAID': 'success',
      'UNPAID': 'danger',
      'PARTIAL': 'warning',
      'PENDING': 'info'
    };
    return severityMap[status] || 'info';
  }

  getPurchaseStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'PENDING': 'pi pi-clock',
      'APPROVED': 'pi pi-box',
      'RECEIVED': 'pi pi-check-circle',
      'COMPLETED': 'pi pi-flag-fill',
      'CANCELED': 'pi pi-times-circle',
    };
    return iconMap[status] || 'pi pi-question-circle';
  }

  getPurchaseActionButtonIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'PENDING': 'pi pi-arrow-right',
      'APPROVED': 'pi pi-check',
      'RECEIVED': 'pi pi-flag',
      'CANCELED': 'pi pi-check-circle'
    };
    return iconMap[status] || 'pi pi-arrow-right';
  }

  getPurchaseActionButtonSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'PENDING': 'primary',
      'APPROVED': 'warning',
      'RECEIVED': 'success',
      'CANCELED': 'help'
    };
    return severityMap[status] || 'primary';
  }

  showPurchaseEventButton(event: any): boolean {
    if (!this.purchase) return false;
    const statusOrder = ['PENDING', 'APPROVED', 'RECEIVED', 'COMPLETED'];
    const currentStatusIndex = statusOrder.indexOf(this.purchase?.purchaseStatus);
    const eventStatusIndex = statusOrder.indexOf(event.status);
    return eventStatusIndex === currentStatusIndex && event.button !== null;
  }

  getPurchaseStatusDescription(status: string): string {
    const descriptions: { [key: string]: string } = {
      'PENDING': this.translate.instant('purchase_status_pending_description'),
      'APPROVED': this.translate.instant('purchase_status_approved_description'),
      'RECEIVED': this.translate.instant('purchase_status_received_description'),
      'COMPLETED': this.translate.instant('purchase_status_completed_description'),
      'CANCELED': this.translate.instant('purchase_status_canceled_description')
    };
    return descriptions[status] || this.translate.instant('status_description_not_available');
  }

  updatePurchaseStatus() {
    if (!this.purchase) return;
    const currentStatus = this.purchase?.purchaseStatus;
    const statusOrder = ['PENDING', 'APPROVED', 'RECEIVED', 'COMPLETED'];
    const currentIndex = statusOrder.indexOf(currentStatus);

    if (currentIndex < statusOrder.length - 1) {
      const nextStatus = statusOrder[currentIndex + 1];
      this.purchase.purchaseStatus = nextStatus;
      this.updatePurchaseStatusInBackend(this.purchase);
    }
  }

  updatePurchaseStatusInBackend(purchase: Purchase) {
    this.purchaseService.updatePurchaseStatus(purchase.purchaseId, purchase).subscribe({
      next: (updatedPurchase) => {
        this.purchase = updatedPurchase;
        this.generatePurchaseEvents();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('purchase_status_updated')
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('purchase_status_update_failed')
        });
      }
    });
  }

  getPurchaseSubtotal(): number {
    return this.purchase?.purchaseItems?.reduce((sum: number, item: any) =>
      sum + (item.totalCost || 0), 0) || 0;
  }

  isPurchaseEventActive(event: any): boolean {
    if (!this.purchase) return false;
    const statusPurchase = ['PENDING', 'APPROVED', 'RECEIVED', 'COMPLETED', 'CANCELED', 'RETURNED', 'PARTIAL_RETURN', 'RETURN_PENDING'];
    const currentStatusIndex = statusPurchase.indexOf(this.purchase?.purchaseStatus);
    const eventStatusIndex = statusPurchase.indexOf(event.status);
    return eventStatusIndex <= currentStatusIndex;
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canEdit = this.permissionService.canUpdate(this.Ressource);
    this.canDelete = this.permissionService.canDelete(this.Ressource);
    this.canProcess = this.permissionService.canProcess(this.Ressource);
    this.canCancel = this.permissionService.canCancel(this.Ressource);
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  // Quick action methods
  printPurchaseInvoice(purchase: any) {
    // Implement print functionality
    console.log('Print purchase invoice:', purchase);
  }

  exportPurchaseToPDF(purchase: any) {
    // Implement PDF export functionality
    console.log('Export purchase to PDF:', purchase);
  }

  refreshPurchaseDetails() {
    this.loadPurchase();
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('success'),
      detail: this.translate.instant('purchase_refreshed'),
      life: 3000
    });
  }

  editPurchase() {
    if (!this.canEdit || !this.purchase) return;
    this.router.navigate(['/inventory/purchases'], { queryParams: { edit: this.purchaseId } });
  }

  deletePurchase() {
    if (!this.canDelete || !this.purchase) return;
    if (confirm(this.translate.instant('delete_confirmation_msg_with_param').replace('{0}', this.purchase?.reference || ''))) {
      this.purchaseService.deletePurchase(this.purchaseId).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('purchase_deleted'),
            life: 3000
          });
          this.router.navigate(['/inventory/purchases']);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_deleting_purchase'),
            life: 3000
          });
        }
      });
    }
  }

  goBack(): void {
    this.location.back();
  }
}

