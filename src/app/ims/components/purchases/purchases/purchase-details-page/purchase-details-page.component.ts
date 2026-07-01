import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { MessageService, MenuItem } from 'primeng/api';
import { Purchase, PurchaseAttachment, PurchaseAttachmentTypeConfig } from 'src/app/models/purchase';
import { FinancialDocument } from 'src/app/models/financialDocument';
import { PurchaseService } from 'src/app/services/purchase.service';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { firstValueFrom, Subscription } from 'rxjs';
import { ProcessModeService } from 'src/app/services/process-mode.service';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';
import {
  formatLineQuantity,
  getLineMeasureUnit,
  getPurchaseItemDisplayQuantity,
  getPurchaseItemLineGrossAmount as purchaseItemLineGrossAmount,
  getPurchaseItemLineNetAmount as purchaseItemLineNetAmount,
} from 'src/app/shared/product-utils';
import { PurchaseItem } from 'src/app/models/purchaseItem';

@Component({
  selector: 'app-purchase-details-page',
  templateUrl: './purchase-details-page.component.html',
  styleUrls: ['./purchase-details-page.component.css', '../purchases.component.css']
})
export class PurchaseDetailsPageComponent implements OnInit {
  TablePageSizeKeys = TablePageSizeKeys;
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

  purchaseDocumentChainMode = false;
  documentChainSteps: MenuItem[] = [];
  documentChainActiveIndex = 0;
  purchaseAttachments: PurchaseAttachment[] = [];
  hasPurchaseOrderDocument: boolean = false;
  attachmentUploading: boolean = false;
  attachmentNotes: string = '';
  attachmentDocumentType: string = '';
  attachmentTypes: string[] = ['SUPPLIER_INVOICE', 'RECEIPT', 'DELIVERY_NOTE', 'PURCHASE_ORDER', 'OTHER'];
  attachmentTypeConfigs: PurchaseAttachmentTypeConfig[] = [];
  requiredAttachmentTypes: string[] = [];
  attachmentPreviewVisible: boolean = false;
  attachmentPreviewUrl: string = '';
  attachmentPreviewSafeUrl: SafeResourceUrl | null = null;
  attachmentPreviewIsPdf: boolean = false;
  attachmentPreviewTitle: string = '';

  private processFlagsSub?: Subscription;
  private readonly attachmentDocumentTypeTranslationKeys: Record<string, string> = {
    SUPPLIER_INVOICE: 'purchase_attachment_document_type_supplier_invoice',
    RECEIPT: 'purchase_attachment_document_type_receipt',
    DELIVERY_NOTE: 'purchase_attachment_document_type_delivery_note',
    PURCHASE_ORDER: 'purchase_attachment_document_type_purchase_order',
    OTHER: 'purchase_attachment_document_type_other'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private purchaseService: PurchaseService,
    private financialDocService: FinancialDocumentsService,
    private messageService: MessageService,
    private translate: TranslateService,
    private sanitizer: DomSanitizer,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translateService: TranslationService,
    private processModeService: ProcessModeService,
    public pageSizeService: TablePageSizeService
  ) {}

  async ngOnInit() {
    this.isLoading = true;
    
    // Load token first
    this.purchaseService.loadToken();

    await this.processModeService.ensureLoaded();
    this.purchaseDocumentChainMode = this.processModeService.isPurchaseDocumentChain();
    await this.loadAttachmentTypeConfigs();
    
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      if (this.purchase) {
        this.generatePurchaseEvents();
        this.refreshDocumentChainStepper();
      }
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
        this.router.navigate(['/purchases/purchases']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadPurchase();
    });
  }

  ngOnDestroy(): void {
    this.processFlagsSub?.unsubscribe();
    this.closeAttachmentPreview(true);
  }

  private applyPurchaseProcessFlagsAfterSettingsSave(): void {
    this.purchaseDocumentChainMode = this.processModeService.isPurchaseDocumentChain();
    if (this.purchase) {
      this.generatePurchaseEvents();
      this.refreshDocumentChainStepper();
    }
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
        this.router.navigate(['/purchases/purchases']);
        return;
      }

      this.generatePurchaseEvents();
      this.refreshDocumentChainStepper();
      await this.loadAttachments();
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
        this.router.navigate(['/purchases/purchases']);
      }, 2000);
    }
  }

  generatePurchaseEvents() {
    if (!this.purchase) return;
    const dc = this.purchaseDocumentChainMode;

    this.purchaseEvents = [
      {
        status: 'PENDING',
        date: this.purchase?.dateOfPurchase,
        icon: 'pi pi-shopping-cart',
        button: dc
          ? this.translate.instant('doc_chain_purchase_timeline_btn_to_approved')
          : this.translate.instant('purchase_timeline_btn_to_approved'),
      },
      {
        status: 'APPROVED',
        date: this.purchase?.approvedDate,
        icon: 'pi pi-box',
        button: dc
          ? this.translate.instant('doc_chain_purchase_timeline_btn_to_received')
          : this.translate.instant('purchase_timeline_btn_to_received'),
      },
      {
        status: 'RECEIVED',
        date: this.purchase?.receivedDate,
        icon: 'pi pi-check-circle',
        button: dc
          ? this.translate.instant('doc_chain_purchase_timeline_btn_to_completed')
          : this.translate.instant('purchase_timeline_btn_to_completed'),
      },
      {
        status: 'COMPLETED',
        date: this.purchase?.completionDate,
        icon: 'pi pi-flag-fill',
        button: null,
      },
    ].filter(event => event.date != null || event.status === 'PENDING');
  }

  private refreshDocumentChainStepper(): void {
    if (!this.purchaseDocumentChainMode || !this.purchase) {
      this.documentChainSteps = [];
      this.documentChainActiveIndex = 0;
      return;
    }
    const L = (key: string) => this.translate.instant(key);
    this.documentChainSteps = [
      { label: L('doc_chain_purchase_step_request') },
      { label: L('doc_chain_purchase_step_approval') },
      { label: L('doc_chain_purchase_step_receipt') },
      { label: L('doc_chain_purchase_step_closure') },
    ];
    switch (this.purchase.purchaseStatus) {
      case 'PENDING':
        this.documentChainActiveIndex = 0;
        break;
      case 'APPROVED':
        this.documentChainActiveIndex = 1;
        break;
      case 'RECEIVED':
        this.documentChainActiveIndex = 2;
        break;
      case 'COMPLETED':
        this.documentChainActiveIndex = 3;
        break;
      default:
        this.documentChainActiveIndex = 0;
        break;
    }
  }

  getHeroPurchaseStatusKey(): string {
    if (!this.purchase?.purchaseStatus) return '';
    const s = this.purchase.purchaseStatus.toLowerCase();
    return (this.purchaseDocumentChainMode ? 'doc_chain_purchase_tag_status_' : 'purchase_status_') + s;
  }

  getHeroPurchasePaymentKey(): string {
    if (!this.purchase?.paymentStatus) return '';
    const s = this.purchase.paymentStatus.toLowerCase();
    return (this.purchaseDocumentChainMode ? 'doc_chain_purchase_payment_tag_' : 'purchase_payment_status_') + s;
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
    if (!this.canProcess) return false;
    const statusOrder = ['PENDING', 'APPROVED', 'RECEIVED', 'COMPLETED'];
    const currentStatusIndex = statusOrder.indexOf(this.purchase?.purchaseStatus);
    const eventStatusIndex = statusOrder.indexOf(event.status);
    return eventStatusIndex === currentStatusIndex && event.button !== null;
  }

  getPurchaseStatusDescription(status: string): string {
    if (this.purchaseDocumentChainMode) {
      const dc: { [key: string]: string } = {
        PENDING: this.translate.instant('doc_chain_purchase_desc_pending'),
        APPROVED: this.translate.instant('doc_chain_purchase_desc_approved'),
        RECEIVED: this.translate.instant('doc_chain_purchase_desc_received'),
        COMPLETED: this.translate.instant('doc_chain_purchase_desc_completed'),
        CANCELED: this.translate.instant('purchase_status_cancelled_description'),
      };
      return dc[status] || this.translate.instant('status_description_not_available');
    }
    const descriptions: { [key: string]: string } = {
      'PENDING': this.translate.instant('purchase_status_pending_description'),
      'APPROVED': this.translate.instant('purchase_status_approved_description'),
      'RECEIVED': this.translate.instant('purchase_status_received_description'),
      'COMPLETED': this.translate.instant('purchase_status_completed_description'),
      'CANCELED': this.translate.instant('purchase_status_cancelled_description')
    };
    return descriptions[status] || this.translate.instant('status_description_not_available');
  }

  updatePurchaseStatus() {
    if (!this.purchase) return;
    if (!this.canProcess) return;
    const currentStatus = this.purchase?.purchaseStatus;
    const statusOrder = ['PENDING', 'APPROVED', 'RECEIVED', 'COMPLETED'];
    const currentIndex = statusOrder.indexOf(currentStatus);

    if (currentIndex < statusOrder.length - 1) {
      const nextStatus = statusOrder[currentIndex + 1];
      this.updatePurchaseStatusInBackend(nextStatus);
    }
  }

  updatePurchaseStatusInBackend(nextStatus: string) {
    if (!this.purchase?.purchaseId) {
      return;
    }
    const payload: Purchase = {
      ...this.purchase,
      purchaseStatus: nextStatus,
    };
    this.purchaseService.updatePurchaseStatus(this.purchase.purchaseId, payload).subscribe({
      next: (updatedPurchase) => {
        this.purchase = updatedPurchase;
        this.generatePurchaseEvents();
        this.refreshDocumentChainStepper();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('purchase_status_updated')
        });
      },
      error: (error: any) => {
        const rawErrorMessage = String(error?.error?.message || error?.message || '').toLowerCase();
        const isPaymentConfirmationBlocked =
          rawErrorMessage.includes('cannot confirm payment') ||
          rawErrorMessage.includes('reconcil') ||
          rawErrorMessage.includes('bank transaction');
        const errorMessage = isPaymentConfirmationBlocked
          ? this.translate.instant('cannot_confirm_payment_reconciliation_required_detail')
          : (error?.error?.message ||
            error?.message ||
            this.translate.instant('purchase_status_update_failed'));
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: errorMessage
        });
        if (isPaymentConfirmationBlocked) {
          this.messageService.add({
            severity: 'info',
            summary: this.translate.instant('purchase_payments'),
            detail: this.translate.instant('cannot_confirm_payment_reconciliation_required')
          });
        }
        // Ensure UI stays in sync when backend rejects transition.
        void this.loadPurchase();
      }
    });
  }

  getPurchaseSubtotal(): number {
    return this.purchase?.purchaseItems?.reduce((sum: number, item: PurchaseItem) =>
      sum + purchaseItemLineNetAmount(item), 0) || 0;
  }

  getPurchaseLineTaxTotal(): number {
    return this.purchase?.purchaseItems?.reduce((sum: number, item: any) =>
      sum + (item.lineTaxAmount || 0), 0) || 0;
  }

  getPurchaseLineGrossTotal(): number {
    return this.purchase?.purchaseItems?.reduce((sum: number, item: PurchaseItem) =>
      sum + purchaseItemLineGrossAmount(item), 0) || 0;
  }

  formatTaxRate(rate?: number | null): string {
    if (rate == null) return '—';
    return `${(rate * 100).toFixed(2)}%`;
  }

  isPurchaseEventActive(event: any): boolean {
    if (!this.purchase) return false;
    return event.status === this.purchase.purchaseStatus;
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

  editPurchase() {
    if (!this.canEdit || !this.purchase) return;
    this.router.navigate(['/purchases/purchases'], { queryParams: { edit: this.purchaseId } });
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
          this.router.navigate(['/purchases/purchases']);
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

  navigateToReturns(): void {
    if (this.purchase?.purchaseId) {
      this.router.navigate(['/purchases/purchase-returns'], { 
        queryParams: { purchaseId: this.purchase.purchaseId } 
      });
    }
  }

  navigateToPurchasePayments(): void {
    if (!this.purchase?.purchaseId) {
      this.router.navigate(['/finance/payments/purchase']);
      return;
    }
    this.router.navigate(['/finance/payments/purchase'], {
      queryParams: { purchaseId: this.purchase.purchaseId }
    });
  }

  goBack(): void {
    this.location.back();
  }

  async loadAttachments(): Promise<void> {
    if (!this.purchase?.purchaseId) {
      this.purchaseAttachments = [];
      return;
    }
    try {
      const response = await firstValueFrom(this.purchaseService.getPurchaseAttachments(this.purchase.purchaseId));
      this.purchaseAttachments = Array.isArray(response) ? response : [];
    } catch (error) {
      this.purchaseAttachments = [];
    }
    await this.refreshPurchaseOrderDocumentAvailability();
  }

  private async loadAttachmentTypeConfigs(): Promise<void> {
    try {
      const response = await firstValueFrom(this.purchaseService.getPurchaseAttachmentDocumentTypes());
      const configs: PurchaseAttachmentTypeConfig[] = Array.isArray(response) ? response : [];
      if (!configs.length) {
        return;
      }
      this.attachmentTypeConfigs = configs;
      this.attachmentTypes = configs.map(c => c.code);
      this.requiredAttachmentTypes = configs.filter(c => c.required).map(c => c.code);
      if (!this.attachmentDocumentType && this.requiredAttachmentTypes.length === 1) {
        this.attachmentDocumentType = this.requiredAttachmentTypes[0];
      }
    } catch (error) {
      // fallback to default static list when backend config is unavailable
    }
  }

  getAttachmentDocumentTypeLabel(type?: string | null): string {
    const value = (type || '').trim();
    if (!value) {
      return '';
    }

    const normalizedValue = value.toUpperCase().replace(/[\s-]+/g, '_');
    const key = this.attachmentDocumentTypeTranslationKeys[normalizedValue];
    if (key) {
      return this.translate.instant(key);
    }

    return value
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  getAttachmentDocumentTypeLabels(types: string[]): string {
    return types.map(type => this.getAttachmentDocumentTypeLabel(type)).filter(Boolean).join(', ');
  }

  triggerAttachmentUpload(fileInput: HTMLInputElement): void {
    if (this.attachmentUploading) {
      return;
    }
    fileInput.click();
  }

  onAttachmentFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file || !this.purchase?.purchaseId) {
      return;
    }

    this.attachmentUploading = true;
    this.purchaseService.uploadPurchaseAttachment(
      this.purchase.purchaseId,
      file,
      this.attachmentDocumentType || undefined,
      this.attachmentNotes || undefined
    ).subscribe({
      next: () => {
        this.attachmentUploading = false;
        this.attachmentNotes = '';
        this.attachmentDocumentType = '';
        input.value = '';
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('expense_attachment_uploaded')
        });
        void this.loadAttachments();
      },
      error: (err: any) => {
        this.attachmentUploading = false;
        input.value = '';
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: err?.error?.message || err?.message || this.translate.instant('expense_attachment_upload_failed')
        });
      }
    });
  }

  deleteAttachment(att: PurchaseAttachment): void {
    if (!this.purchase?.purchaseId || !att?.id) {
      return;
    }
    this.purchaseService.deletePurchaseAttachment(this.purchase.purchaseId, att.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('expense_attachment_deleted')
        });
        this.purchaseAttachments = this.purchaseAttachments.filter(a => a.id !== att.id);
        void this.refreshPurchaseOrderDocumentAvailability();
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: err?.error?.message || err?.message || this.translate.instant('error')
        });
      }
    });
  }

  downloadAttachment(att: PurchaseAttachment): void {
    if (!this.purchase?.purchaseId || !att?.id) {
      return;
    }
    this.purchaseService.getPurchaseAttachmentBlob(this.purchase.purchaseId, att.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.attachmentDisplayName(att);
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: err?.error?.message || err?.message || this.translate.instant('error')
        });
      }
    });
  }

  attachmentDisplayName(att: PurchaseAttachment): string {
    return att?.originalFilename || `attachment-${att?.id ?? ''}`;
  }

  async viewPurchaseOrderDocument(_purchase: Purchase): Promise<void> {
    const handled = await this.openGeneratedPurchaseOrderIfExists();
    if (handled) {
      return;
    }
    const supplierPo = this.findLatestAttachmentByType('PURCHASE_ORDER');
    if (supplierPo) {
      this.previewAttachment(supplierPo);
      return;
    }
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('purchase_documents_menu_title'),
      detail: this.translate.instant('expense_attachments_empty')
    });
  }

  previewAttachment(att: PurchaseAttachment): void {
    if (!this.purchase?.purchaseId || !att?.id) {
      return;
    }
    this.purchaseService.getPurchaseAttachmentBlob(this.purchase.purchaseId, att.id).subscribe({
      next: (blob: Blob) => {
        this.closeAttachmentPreview(true);
        const url = window.URL.createObjectURL(blob);
        const contentType = (att.contentType || blob.type || '').toLowerCase();
        this.attachmentPreviewIsPdf = contentType.includes('pdf');
        this.attachmentPreviewTitle = this.attachmentDisplayName(att);
        this.attachmentPreviewUrl = url;
        this.attachmentPreviewSafeUrl = this.attachmentPreviewIsPdf
          ? this.sanitizer.bypassSecurityTrustResourceUrl(url)
          : null;
        this.attachmentPreviewVisible = true;
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: err?.error?.message || err?.message || this.translate.instant('error')
        });
      }
    });
  }

  closeAttachmentPreview(force: boolean = false): void {
    if (!force && !this.attachmentPreviewVisible) {
      return;
    }
    if (this.attachmentPreviewUrl) {
      window.URL.revokeObjectURL(this.attachmentPreviewUrl);
    }
    this.attachmentPreviewVisible = false;
    this.attachmentPreviewUrl = '';
    this.attachmentPreviewSafeUrl = null;
    this.attachmentPreviewIsPdf = false;
    this.attachmentPreviewTitle = '';
  }

  private async findGeneratedPurchaseOrder(): Promise<FinancialDocument | null> {
    try {
      this.financialDocService.loadToken();
      const response = await firstValueFrom(this.financialDocService.getFinancialDocs());
      const financialDocs = this.extractFinancialDocs(response);
      const generatedPo = financialDocs.find((doc: FinancialDocument) => {
        const isPo = doc.docType === 'PURCHASE_ORDER';
        const linkedByPurchase = (doc as any)?.purchase?.purchaseId === this.purchase?.purchaseId;
        const linkedByReference = !!this.purchase?.reference
          && String((doc as any)?.additionalReferences || '').includes(this.purchase.reference);
        return isPo && (linkedByPurchase || linkedByReference);
      });
      return generatedPo || null;
    } catch (_error) {
      return null;
    }
  }

  private async openGeneratedPurchaseOrderIfExists(): Promise<boolean> {
    const generatedPo = await this.findGeneratedPurchaseOrder();
    if (generatedPo?.docNumber) {
      this.financialDocService.printFinancialDoc(generatedPo.docNumber);
      return true;
    }
    return false;
  }

  /**
   * A purchase-order document is available either as a generated financial
   * document (PURCHASE_ORDER) linked to this purchase, or as an uploaded
   * PURCHASE_ORDER attachment. Used to enable/disable the "view purchase order"
   * quick action so we never surface an empty-state toast.
   */
  private async refreshPurchaseOrderDocumentAvailability(): Promise<void> {
    if (this.findLatestAttachmentByType('PURCHASE_ORDER')) {
      this.hasPurchaseOrderDocument = true;
      return;
    }
    const generatedPo = await this.findGeneratedPurchaseOrder();
    this.hasPurchaseOrderDocument = !!generatedPo?.docNumber;
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

  private findLatestAttachmentByType(type: string): PurchaseAttachment | null {
    const matches = this.purchaseAttachments.filter(a => (a.documentType || '').toUpperCase() === type.toUpperCase());
    if (!matches.length) {
      return null;
    }
    return [...matches].sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')))[0];
  }

  formatPurchaseItemQty(item: PurchaseItem): string {
    return formatLineQuantity(item?.product, getPurchaseItemDisplayQuantity(item));
  }

  getPurchaseItemMeasureUnit(item: PurchaseItem): string {
    return getLineMeasureUnit(item?.product, getPurchaseItemDisplayQuantity(item));
  }

  getPurchaseUnitPriceLabel(item: PurchaseItem): string {
    return getLineMeasureUnit(item?.product, 1);
  }

  getPurchaseItemLineNetAmount(item: PurchaseItem): number {
    return purchaseItemLineNetAmount(item);
  }

  getPurchaseItemLineGrossAmount(item: PurchaseItem): number {
    return purchaseItemLineGrossAmount(item);
  }

}

