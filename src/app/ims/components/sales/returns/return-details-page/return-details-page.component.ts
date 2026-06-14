import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { FinancialDocument } from 'src/app/models/financialDocument';
import { Order } from 'src/app/models/order';
import { Product } from 'src/app/models/product';
import { Refund } from 'src/app/models/refund';
import { ReturnStatus } from 'src/app/enums/return-status.enum';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { getQuantitySeverity, getMeasureUnit } from 'src/app/shared/product-utils';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

@Component({
  selector: 'app-return-details-page',
  templateUrl: './return-details-page.component.html',
  styleUrls: ['./return-details-page.component.css', '../returns.component.css']
})
export class ReturnDetailsPageComponent implements OnInit, OnDestroy {
  TablePageSizeKeys = TablePageSizeKeys;
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
  returnNoteDocNumber: string | null = null;
  creditNoteDocNumber: string | null = null;

  private readonly destroy$ = new Subject<void>();

  /** Status milestones for the order-return workflow (same pattern as purchase returns / order details). */
  returnEvents: Array<{ status: string; date: Date | string | null; icon: string }> = [];

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
    public financialDocService: FinancialDocumentsService,
    public pageSizeService: TablePageSizeService
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

    await this.loadLowStockThreshold();

    this.configService.configurationSaved$
      .pipe(takeUntil(this.destroy$))
      .subscribe((key) => {
        if (key === 'lowStockThreshold') {
          void this.loadLowStockThreshold();
        }
      });

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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadLowStockThreshold(): Promise<void> {
    try {
      const thresholdObservable = await this.configService.getConfiguration('lowStockThreshold');
      const threshold = await firstValueFrom(thresholdObservable);
      this.lowStockThreshold =
        threshold !== undefined && threshold !== null && (threshold as any).value !== undefined
          ? Number((threshold as any).value)
          : 10;
    } catch (error) {
      console.error('Error fetching low stock threshold:', error);
      this.lowStockThreshold = 10;
    }
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

      this.generateReturnEvents();
      await this.checkForLinkedFinancialDocuments(this.return.returnId);
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

  generateReturnEvents(): void {
    if (!this.return) {
      this.returnEvents = [];
      return;
    }

    const status = String(this.return.returnStatus ?? '').trim().toUpperCase();
    const creation = this.return.creationDate;
    const retDate = this.return.returnDate;
    const normalFlow = ['PENDING', 'PROCESSING', 'PARTIALLY_REFUNDED', 'COMPLETED'];
    /** API may return APPROVED while the enum focuses on PROCESSING — align milestone index. */
    const flowIndexStatus = status === 'APPROVED' ? 'PROCESSING' : status;
    const idx = normalFlow.indexOf(flowIndexStatus);

    if (status === 'CANCELLED') {
      this.returnEvents = [
        { status: 'PENDING', date: creation ?? null, icon: 'pi pi-clock' },
        { status: 'CANCELLED', date: retDate || creation || null, icon: 'pi pi-times-circle' }
      ].filter(e => e.date != null || e.status === 'PENDING');
      return;
    }

    if (status === 'REJECTED') {
      this.returnEvents = [
        { status: 'PENDING', date: creation ?? null, icon: 'pi pi-clock' },
        { status: 'REJECTED', date: retDate || creation || null, icon: 'pi pi-times-circle' }
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
        date: status === 'PARTIALLY_REFUNDED' ? (retDate || creation || null) : null,
        icon: 'pi pi-percentage'
      },
      {
        status: 'COMPLETED',
        date: status === 'COMPLETED' ? (retDate || creation || null) : null,
        icon: 'pi pi-check-circle'
      }
    ];

    this.returnEvents = events.filter(e => e.date != null || e.status === 'PENDING');
  }

  isReturnTimelineEventActive(event: { status: string }): boolean {
    if (this.return?.returnStatus == null) {
      return false;
    }
    const current = String(this.return.returnStatus).trim().toUpperCase();
    const ev = event.status.toUpperCase();
    if (current === ev) return true;
    if (current === 'APPROVED' && ev === 'PROCESSING') return true;
    return false;
  }

  getOrderReturnTimelineDescription(status: string): string {
    const key = `order_return_timeline_${status.toLowerCase()}_description`;
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

  private extractFinancialDocs(response: any): FinancialDocument[] {
    if (!response) {
      return [];
    }
    if (Array.isArray(response)) {
      return response as FinancialDocument[];
    }
    if (Array.isArray(response.page?.content)) {
      return response.page.content as FinancialDocument[];
    }
    if (Array.isArray(response.content)) {
      return response.content as FinancialDocument[];
    }
    return [];
  }

  private async loadFinancialDocsForReturnLookup(): Promise<FinancialDocument[]> {
    this.financialDocService.loadToken();

    const orderId = this.return?.order?.orderId;
    if (orderId) {
      try {
        const orderDocs = await firstValueFrom(
          this.financialDocService.getFinancialDocsByOrder(orderId)
        );
        const extracted = this.extractFinancialDocs(orderDocs);
        if (extracted.length > 0) {
          return extracted;
        }
      } catch (error) {
        console.warn('Could not load financial documents by order, falling back to global list:', error);
      }
    }

    const response = await firstValueFrom(this.financialDocService.getFinancialDocs());
    return this.extractFinancialDocs(response);
  }

  hasProcessedRefund(): boolean {
    const refunds = this.return?.refunds || [];
    return refunds.some((refund) => {
      const status = String(refund.status || '').toUpperCase();
      return status === 'SETTLED' || status === 'PARTIAL_REFUND';
    });
  }

  canGenerateCreditNote(): boolean {
    if (!this.isAdmin || !this.return || this.creditNoteDocNumber) {
      return false;
    }

    const status = String(this.return.returnStatus || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'CANCELED') {
      return false;
    }

    const eligibleStatuses = ['PROCESSING', 'PARTIALLY_REFUNDED', 'COMPLETED'];
    if (!eligibleStatuses.includes(status)) {
      return false;
    }

    return (this.return.totalRefundableAmount ?? 0) > 0 && this.hasProcessedRefund();
  }

  private resolveLinkedReturnDocNumber(
    financialDocs: FinancialDocument[],
    returnId: number,
    docType: 'RETURN_NOTE' | 'CREDIT_NOTE'
  ): string | null {
    const matchedByReturnId = financialDocs.find(
      (doc: FinancialDocument) =>
        doc.docType === docType &&
        doc.returnId === returnId &&
        doc.docStatus !== 'CANCELLED'
    );
    if (matchedByReturnId?.docNumber) {
      return matchedByReturnId.docNumber;
    }

    if (docType === 'RETURN_NOTE') {
      const returnIdPattern = `RETURN-${returnId}`;
      const matchedByRef = financialDocs.find(
        (doc: FinancialDocument) =>
          doc.docType === docType &&
          doc.docStatus !== 'CANCELLED' &&
          (doc.additionalReferences?.includes(returnIdPattern) ||
            doc.additionalReferences?.includes(`RET-${returnId}`) ||
            doc.notes?.includes(returnIdPattern))
      );
      if (matchedByRef?.docNumber) {
        return matchedByRef.docNumber;
      }
    }

    if (!this.return?.order?.orderId) {
      return null;
    }

    const orderId = Number(this.return.order.orderId);
    const linkedDocs = financialDocs.filter((doc: FinancialDocument) => {
      const docOrderId = doc.order?.orderId ? Number(doc.order.orderId) : null;
      return doc.docType === docType &&
        docOrderId === orderId &&
        doc.docStatus !== 'CANCELLED';
    });

    if (linkedDocs.length === 0) {
      return null;
    }
    if (linkedDocs.length === 1) {
      return linkedDocs[0].docNumber || null;
    }

    if (this.return?.returnDate) {
      const returnDate = new Date(this.return.returnDate);
      const matchedByDate = linkedDocs.find((doc: FinancialDocument) => {
        if (!doc.issuedAt && !doc.createdAt) {
          return false;
        }
        const docDate = doc.issuedAt
          ? new Date(doc.issuedAt)
          : new Date(doc.createdAt as any);
        const diffDays = Math.abs(
          (docDate.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diffDays <= 1;
      });
      if (matchedByDate?.docNumber) {
        return matchedByDate.docNumber;
      }
    }

    const sortedDocs = [...linkedDocs].sort((a, b) => {
      const dateA = a.issuedAt
        ? new Date(a.issuedAt).getTime()
        : (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
      const dateB = b.issuedAt
        ? new Date(b.issuedAt).getTime()
        : (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
      return dateB - dateA;
    });

    return sortedDocs[0]?.docNumber || null;
  }

  async checkForLinkedFinancialDocuments(returnId: number): Promise<void> {
    try {
      if (!this.return || !this.return.returnId) {
        this.returnNoteDocNumber = null;
        this.creditNoteDocNumber = null;
        return;
      }

      const financialDocs = await this.loadFinancialDocsForReturnLookup();
      this.returnNoteDocNumber = this.resolveLinkedReturnDocNumber(
        financialDocs,
        returnId,
        'RETURN_NOTE'
      );
      this.creditNoteDocNumber = this.resolveLinkedReturnDocNumber(
        financialDocs,
        returnId,
        'CREDIT_NOTE'
      );
    } catch (error: any) {
      console.error('Error checking for linked financial documents:', error);
    }
  }

  generateReturnNote(): void {
    if (!this.return?.returnId) return;

    this.financialDocService.generateReturnNoteFromReturn(this.return.returnId, {
      origin: 'BACK_OFFICE'
    }).subscribe({
      next: (response: any) => {
        const generatedDocNumber = response?.number || response?.docNumber || null;
        if (generatedDocNumber) {
          this.returnNoteDocNumber = generatedDocNumber;
        }

        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('return_note_generated_successfully') || 'Return note generated successfully',
          life: 3000
        });

        void this.checkForLinkedFinancialDocuments(this.return!.returnId).then(() => {
          if (!this.returnNoteDocNumber && generatedDocNumber) {
            this.returnNoteDocNumber = generatedDocNumber;
          }
        });
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_generating_return_note') || 'Error while generating return note',
          life: 3000
        });
      }
    });
  }

  generateCreditNote(): void {
    if (!this.return?.returnId || !this.canGenerateCreditNote()) {
      return;
    }

    this.financialDocService.generateCreditNoteFromReturn(this.return.returnId, {
      origin: 'BACK_OFFICE'
    }).subscribe({
      next: (response: any) => {
        const generatedDocNumber = response?.number || response?.docNumber || null;
        if (generatedDocNumber) {
          this.creditNoteDocNumber = generatedDocNumber;
        }

        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('credit_note_generated_successfully') || 'Credit note generated successfully',
          life: 3000
        });

        void this.checkForLinkedFinancialDocuments(this.return!.returnId).then(() => {
          if (!this.creditNoteDocNumber && generatedDocNumber) {
            this.creditNoteDocNumber = generatedDocNumber;
          }
        });
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_generating_credit_note') || 'Error while generating credit note',
          life: 3000
        });
      }
    });
  }

  viewReturnNote(): void {
    if (this.returnNoteDocNumber) {
      this.financialDocService.printFinancialDoc(this.returnNoteDocNumber);
    }
  }

  viewCreditNote(): void {
    if (this.creditNoteDocNumber) {
      this.financialDocService.printFinancialDoc(this.creditNoteDocNumber);
    }
  }
}
