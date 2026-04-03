import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { PurchaseReturn } from 'src/app/models/purchaseReturn';
import { PurchaseReturnService } from 'src/app/services/purchase-return.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { Purchase } from 'src/app/models/purchase';
import { Product } from 'src/app/models/product';
import { PurchaseCredit } from 'src/app/models/purchaseCredit';
import { ReturnStatus } from 'src/app/enums/return-status.enum';
import { firstValueFrom } from 'rxjs';
import { getQuantitySeverity, getMeasureUnit } from 'src/app/shared/product-utils';

@Component({
  selector: 'app-purchase-return-details-page',
  templateUrl: './purchase-return-details-page.component.html',
  styleUrls: ['./purchase-return-details-page.component.css', '../purchase-returns.component.css']
})
export class PurchaseReturnDetailsPageComponent implements OnInit {
  returnId!: number;
  return: PurchaseReturn | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  canProcess: boolean = false;
  canCancel: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "PURCHASE_RETURNS";
  
  lowStockThreshold: number = 10;

  /** Status milestones for the return workflow timeline (matches orders / purchase-details style). */
  returnEvents: Array<{ status: string; date: Date | string | null; icon: string }> = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private purchaseReturnService: PurchaseReturnService,
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
    this.purchaseReturnService.loadToken();
    
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    // Get low stock threshold
    try {
      const thresholdObservable = await this.configService.getConfiguration('lowStockThreshold');
      const threshold = await firstValueFrom(thresholdObservable);
      this.lowStockThreshold = (threshold !== undefined && threshold !== null && (threshold as any).value !== undefined)
        ? Number((threshold as any).value)
        : 10;
    } catch (error) {
      console.error('Error fetching low stock threshold:', error);
      this.lowStockThreshold = 10;
    }

    this.route.params.subscribe(async params => {
      this.returnId = +params['id'];
      if (!this.returnId || isNaN(this.returnId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_return_id'),
          life: 3000
        });
        this.router.navigate(['/inventory/purchase-returns']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadReturn();
    });
  }

  async loadReturn(): Promise<void> {
    try {
      // Ensure token is loaded
      this.purchaseReturnService.loadToken();
      
      const response = await firstValueFrom(this.purchaseReturnService.getReturnById(this.returnId));
      console.log('Purchase Return API response:', response);
      
      // Handle different response formats
      let returnData: any;
      if (Array.isArray(response)) {
        returnData = response[0];
      } else if (response && typeof response === 'object') {
        returnData = response;
      } else {
        throw new Error('Unexpected response format from API');
      }
      
      // Normalize purchaseReturnId to returnId for consistency
      if (returnData.purchaseReturnId && !returnData.returnId) {
        returnData.returnId = returnData.purchaseReturnId;
      }
      
      this.return = returnData as PurchaseReturn;
      
      if (!this.return || !this.return.returnId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('return_not_found'),
          life: 3000
        });
        this.router.navigate(['/inventory/purchase-returns']);
        return;
      }

      // Convert date strings to Date objects if needed
      if (this.return.creationDate) {
        this.return.creationDate = new Date(this.return.creationDate as any);
      }
      if (this.return.returnDate) {
        this.return.returnDate = new Date(this.return.returnDate as any);
      }

      this.generateReturnEvents();
      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading purchase return:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_return') || 'Error loading return',
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
    this.canProcess = this.permissionService.canProcess(this.Ressource);
    this.canCancel = this.permissionService.canCancel(this.Ressource);
  }

  async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  goBack(): void {
    this.location.back();
  }

  getSupplierDisplayName(supplier: any): string {
    if (!supplier) return 'N/A';
    return supplier.name || supplier.supplierName || 'N/A';
  }

  getConditionSeverity(condition: any): string {
    switch (condition) {
      case 'NEW': return 'success';
      case 'USED': return 'warning';
      case 'DAMAGED': return 'danger';
      default: return 'info';
    }
  }

  getCreditMethodIcon(method: string): string {
    switch (method) {
      case 'Cash': return 'pi pi-money-bill';
      case 'Card': return 'pi pi-credit-card';
      case 'Transfer': return 'pi pi-bank';
      case 'Check': return 'pi pi-file-edit';
      case 'BOE': return 'pi pi-file-edit';
      default: return 'pi pi-dollar';
    }
  }

  getCreditStatusSeverity(status: string): string {
    switch (status?.toLowerCase()) {
      case 'pending': return 'success';
      case 'processing': return 'info';
      case 'completed': return 'warning';
      case 'failed': return 'danger';
      default: return 'danger';
    }
  }

  getReturnStatusSeverity(status: ReturnStatus): string {
    const statusSeverity: { [key: string]: string } = {
      'PENDING': 'warning',
      'APPROVED': 'success',
      'REJECTED': 'danger',
      'COMPLETED': 'success',
      'CANCELLED': 'danger',
      'PROCESSING': 'info'
    };

    return statusSeverity[status] || 'info';
  }

  generateReturnEvents(): void {
    if (!this.return) {
      this.returnEvents = [];
      return;
    }

    const status = String(this.return.returnStatus || '');
    const creation = this.return.creationDate;
    const retDate = this.return.returnDate;
    const normalFlow = ['PENDING', 'PROCESSING', 'PARTIALLY_REFUNDED', 'COMPLETED'];
    const idx = normalFlow.indexOf(status);

    if (status === ReturnStatus.CANCELLED) {
      this.returnEvents = [
        { status: 'PENDING', date: creation ?? null, icon: 'pi pi-clock' },
        { status: 'CANCELLED', date: retDate || creation || null, icon: 'pi pi-times-circle' }
      ].filter(e => e.date != null || e.status === 'PENDING');
      return;
    }

    const events: Array<{ status: string; date: Date | string | null; icon: string }> = [
      { status: 'PENDING', date: creation ?? null, icon: 'pi pi-clock' },
      {
        status: 'PROCESSING',
        date: idx >= 1 ? (retDate || creation || null) : null,
        icon: 'pi pi-sync'
      },
      {
        status: 'PARTIALLY_REFUNDED',
        date: status === ReturnStatus.PARTIALLY_REFUNDED ? (retDate || creation || null) : null,
        icon: 'pi pi-percentage'
      },
      {
        status: 'COMPLETED',
        date: status === ReturnStatus.COMPLETED ? (retDate || creation || null) : null,
        icon: 'pi pi-check-circle'
      }
    ];

    this.returnEvents = events.filter(e => e.date != null || e.status === 'PENDING');
  }

  isReturnTimelineEventActive(event: { status: string }): boolean {
    if (!this.return?.returnStatus) return false;
    return event.status === this.return.returnStatus;
  }

  getReturnTimelineDescription(status: string): string {
    const key = `purchase_return_timeline_${status.toLowerCase()}_description`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : this.translate.instant('not_available');
  }

  getReturnStatusSeverityTag(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | undefined {
    switch (status?.toUpperCase()) {
      case 'PENDING': return 'warn';
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'danger';
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'danger';
      case 'PROCESSING': return 'info';
      default: return 'secondary';
    }
  }

  getPurchaseStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | undefined {
    switch (status?.toLowerCase()) {
      case 'pending': return 'warn';
      case 'processing': return 'info';
      case 'received': return 'info';
      case 'completed': return 'success';
      case 'canceled': return 'danger';
      default: return 'secondary';
    }
  }

  isCreditActive(credit: PurchaseCredit): boolean {
    if (!this.return?.credits || this.return.credits.length === 0) {
      return false;
    }

    // Assuming the most recent credit is active
    const latestCredit = this.return.credits[this.return.credits.length - 1];
    return credit.creditId === latestCredit.creditId;
  }

  getQuantitySeverity(quantity: number): string {
    if (quantity === undefined || quantity === null) return 'info';
    if (quantity <= 0) return 'danger';
    if (quantity < this.lowStockThreshold) return 'warning';
    return 'success';
  }

  getMeasureUnit(product: Product, quantity?: number): string {
    if (!product || !product.measureUnit) return 'UNIT';
    
    const pluralizable = ['UNIT', 'PIECE', 'BOX', 'METER'];
    const qty = quantity !== undefined ? quantity : (product.quantityAvailable || 0);
    
    if (qty > 1 && pluralizable.includes(product.measureUnit)) {
      return `${product.measureUnit}_plural`;
    }
    
    return product.measureUnit;
  }

  viewPurchase(purchase: Purchase): void {
    if (!purchase || !purchase.purchaseId) return;
    this.router.navigate(['/inventory/purchases', purchase.purchaseId]);
  }

  printReturn(): void {
    window.print();
  }

  refreshReturnDetails(): void {
    if (this.return?.returnId) {
      this.loadReturn();
    }
  }

  generateReturnNote(): void {
    if (!this.return?.returnId) return;
    
    // TODO: Implement purchase return note generation if available
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: this.translate.instant('feature_coming_soon') || 'Feature coming soon',
    });
  }
}

