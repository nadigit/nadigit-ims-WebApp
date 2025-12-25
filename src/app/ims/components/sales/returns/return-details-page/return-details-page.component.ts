import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { OrderReturn } from 'src/app/models/orderReturn';
import { ReturnService } from 'src/app/services/return.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { Order } from 'src/app/models/order';
import { Product } from 'src/app/models/product';
import { Refund } from 'src/app/models/refund';
import { ReturnStatus } from 'src/app/enums/return-status.enum';
import { firstValueFrom } from 'rxjs';
import { getQuantitySeverity, getMeasureUnit } from 'src/app/shared/product-utils';

@Component({
  selector: 'app-return-details-page',
  templateUrl: './return-details-page.component.html',
  styleUrls: ['./return-details-page.component.css', '../returns.component.css']
})
export class ReturnDetailsPageComponent implements OnInit {
  returnId!: number;
  return: OrderReturn | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  canProcess: boolean = false;
  canCancel: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "RETURNS";
  
  lowStockThreshold: number = 10;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private returnService: ReturnService,
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
    this.returnService.loadToken();
    
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
        this.router.navigate(['/sales/returns']);
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
      this.returnService.loadToken();
      
      const response = await firstValueFrom(this.returnService.getReturnById(this.returnId));
      console.log('Return API response:', response);
      
      // Handle different response formats
      if (Array.isArray(response)) {
        this.return = response[0] as OrderReturn;
      } else if (response && typeof response === 'object') {
        this.return = response as OrderReturn;
      } else {
        throw new Error('Unexpected response format from API');
      }
      
      if (!this.return || !this.return.returnId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('return_not_found'),
          life: 3000
        });
        this.router.navigate(['/sales/returns']);
        return;
      }

      // Convert date strings to Date objects if needed
      if (this.return.creationDate) {
        this.return.creationDate = new Date(this.return.creationDate as any);
      }
      if (this.return.returnDate) {
        this.return.returnDate = new Date(this.return.returnDate as any);
      }

      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading return:', error);
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

  getCustomerDisplayName(customer: any): string {
    if (!customer) return 'N/A';
    if (customer.companyName) return customer.companyName;
    const firstName = customer.firstName || '';
    const lastName = customer.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'N/A';
  }

  getConditionSeverity(condition: any): string {
    switch (condition) {
      case 'NEW': return 'success';
      case 'USED': return 'warning';
      case 'DAMAGED': return 'danger';
      default: return 'info';
    }
  }

  getRefundMethodIcon(method: string): string {
    switch (method) {
      case 'Cash': return 'pi pi-money-bill';
      case 'Card': return 'pi pi-credit-card';
      case 'Transfer': return 'pi pi-bank';
      case 'Check': return 'pi pi-file-edit';
      case 'BOE': return 'pi pi-file-edit';
      default: return 'pi pi-dollar';
    }
  }

  getRefundStatusSeverity(status: string): string {
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

  getOrderStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | undefined {
    switch (status?.toLowerCase()) {
      case 'ordered': return 'warn';
      case 'processing': return 'info';
      case 'delivered': return 'info';
      case 'completed': return 'success';
      case 'canceled': return 'danger';
      case 'return_pending': return 'warn';
      case 'partial_return': return 'warn';
      case 'returned': return 'secondary';
      default: return 'secondary';
    }
  }

  isRefundActive(refund: Refund): boolean {
    if (!this.return?.refunds || this.return.refunds.length === 0) {
      return false;
    }

    // Assuming the most recent refund is active
    const latestRefund = this.return.refunds[this.return.refunds.length - 1];
    return refund.refundId === latestRefund.refundId;
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

  viewOrder(order: Order): void {
    if (!order || !order.orderId) return;
    this.router.navigate(['/sales/orders', order.orderId]);
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
    
    this.financialDocService.generateReturnNoteFromReturn(this.return.returnId).subscribe({
      next: (res: any) => {
        this.financialDocService.printFinancialDoc(res.number);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('invoice_generated'),
          detail: res.number,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invoice_generation_failed'),
        });
      }
    });
  }
}

