import { formatDate } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Expense, ExpenseAttachment, ExpenseConfig } from 'src/app/models/expense';
import { ExpenseService } from 'src/app/services/expense.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { ReconciliationValidationService, ReconciliationStatus } from 'src/app/services/reconciliation-validation.service';
import { firstValueFrom } from 'rxjs';
import { getPaymentMethodIcon, getPaymentMethodSeverity } from 'src/app/shared/payment-utils';
import {
  canDeleteExpenseByWorkflowStatus,
  canEditExpenseByWorkflowStatus
} from 'src/app/shared/expense-workflow-utils';

export interface ExpenseTimelineEvent {
  key: string;
  labelKey: string;
  date?: Date | string;
  icon: string;
  by?: string;
  reason?: string;
  markerClass: string;
  sortOrder: number;
}

@Component({
  selector: 'app-expense-details-page',
  templateUrl: './expense-details-page.component.html',
  styleUrls: ['./expense-details-page.component.css', '../expenses.component.css', '../../finance.component.css']
})
export class ExpenseDetailsPageComponent implements OnInit, OnDestroy {
  expenseId!: number;
  expense: Expense | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  expenseEvents: ExpenseTimelineEvent[] = [];

  canEdit: boolean = false;
  canDelete: boolean = false;
  canRead: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  userShopId: number | null = null;
  Ressource: string = 'EXPENSES';

  requireApproval: boolean = false;
  expenseConfigLoaded: boolean = false;

  approveConfirmDialog: boolean = false;
  rejectConfirmDialog: boolean = false;
  rejectionReason: string = '';
  isApprovalActionLoading: boolean = false;

  deleteConfirmDialog: boolean = false;
  isDeleteConfirmLoading: boolean = false;

  attachmentUploading: boolean = false;
  readonly maxAttachmentBytes = 5 * 1024 * 1024;
  readonly maxAttachments = 10;

  /** When true, lazy-loaded image thumbs failed — show type icon instead. */
  attachmentThumbErrors: Record<number, boolean> = {};

  attachmentImagePreviewVisible = false;
  attachmentImagePreviewUrl = '';

  /** Blob URLs from authenticated GET …/attachments/{id}/content (revoked on destroy / reload). */
  attachmentBlobUrlById: Record<number, string> = {};
  attachmentBlobLoadState: Record<number, 'loading' | 'ready' | 'error'> = {};

  /** BCP 47 locale for `DatePipe` / `formatDate` (matches TranslationService language). */
  dateLocale = 'en';

  expenseReconciliationCache: Map<number, ReconciliationStatus> = new Map();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private expenseService: ExpenseService,
    private messageService: MessageService,
    private translate: TranslateService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translateService: TranslationService,
    private reconciliationValidationService: ReconciliationValidationService
  ) {}

  async ngOnInit() {
    this.isLoading = true;

    this.expenseService.loadToken();

    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.dateLocale = this.mapAppLangToDateLocale(this.translateService.getPreferredLanguage());
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.dateLocale = this.mapAppLangToDateLocale(lang);
    });

    this.route.params.subscribe(async params => {
      this.expenseId = +params['id'];
      if (!this.expenseId || isNaN(this.expenseId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_expense_id'),
          life: 3000
        });
        this.router.navigate(['/finance/expenses']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadUserShopId();
      await this.loadExpenseConfig();
      await this.loadExpense();
    });
  }

  private async loadExpenseConfig(): Promise<void> {
    try {
      const cfg = await firstValueFrom(this.expenseService.getExpenseConfig()) as ExpenseConfig;
      this.requireApproval = !!cfg?.requireApproval;
    } catch {
      this.requireApproval = false;
    } finally {
      this.expenseConfigLoaded = true;
    }
  }

  private async loadUserShopId(): Promise<void> {
    try {
      const profile = await this.keycloakService.loadUserProfile();
      const raw = profile?.attributes?.['shop']?.[0];
      this.userShopId = raw != null && raw !== '' ? Number(raw) : null;
    } catch {
      this.userShopId = null;
    }
  }

  async loadExpense(): Promise<void> {
    try {
      this.expenseService.loadToken();

      const response = await firstValueFrom(this.expenseService.getExpense(this.expenseId));

      if (Array.isArray(response)) {
        this.expense = response[0] as Expense;
      } else if (response && typeof response === 'object') {
        this.expense = response as Expense;
      } else {
        throw new Error('Unexpected response format from API');
      }

      if (!this.expense || !this.expense.id) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('expense_not_found'),
          life: 3000
        });
        this.router.navigate(['/finance/expenses']);
        return;
      }

      this.attachmentThumbErrors = {};
      this.generateExpenseEvents();
      if (this.expense.attachments?.length) {
        this.startLoadingAttachmentBlobs();
      } else {
        this.revokeExpenseAttachmentBlobs();
      }
      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading expense:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_expense') || 'Error loading expense',
        life: 3000
      });
      this.isLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.revokeExpenseAttachmentBlobs();
  }

  private revokeExpenseAttachmentBlobs(): void {
    for (const url of Object.values(this.attachmentBlobUrlById)) {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    }
    this.attachmentBlobUrlById = {};
    this.attachmentBlobLoadState = {};
  }

  private startLoadingAttachmentBlobs(): void {
    this.revokeExpenseAttachmentBlobs();
    const e = this.expense;
    if (!e?.id || !e.attachments?.length) {
      return;
    }
    const expenseId = e.id;
    for (const att of e.attachments) {
      if (att.id == null) {
        continue;
      }
      const id = att.id;
      const rawUrl = (att.fileUrl || '').trim();
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        this.attachmentBlobUrlById[id] = rawUrl;
        this.attachmentBlobLoadState[id] = 'ready';
        continue;
      }
      this.attachmentBlobLoadState[id] = 'loading';
      this.expenseService.getExpenseAttachmentBlob(expenseId, id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.attachmentBlobUrlById[id] = url;
          this.attachmentBlobLoadState[id] = 'ready';
        },
        error: () => {
          this.attachmentBlobLoadState[id] = 'error';
        }
      });
    }
  }

  getAttachmentLoadState(id: number | undefined): 'loading' | 'ready' | 'error' | 'idle' {
    if (id == null) {
      return 'idle';
    }
    return this.attachmentBlobLoadState[id] ?? 'idle';
  }

  isAttachmentBlobReady(id: number | undefined): boolean {
    if (id == null) {
      return false;
    }
    return this.attachmentBlobLoadState[id] === 'ready' && !!this.attachmentBlobUrlById[id];
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

  requiresReconciliation(paymentMethod: string | null | undefined): boolean {
    return this.reconciliationValidationService.requiresExpenseBankImpactCheck(paymentMethod);
  }

  canEditExpenseBasedOnReconciliation(expense: Expense | null | undefined): boolean {
    if (!expense?.id || !this.requiresReconciliation(expense.paymentMethod)) {
      return true;
    }
    const status = this.expenseReconciliationCache.get(expense.id);
    return !status || status.canProceed;
  }

  canDeleteExpenseBasedOnReconciliation(expense: Expense | null | undefined): boolean {
    if (!expense?.id || !this.requiresReconciliation(expense.paymentMethod)) {
      return true;
    }
    const status = this.expenseReconciliationCache.get(expense.id);
    return !status || status.canProceed;
  }

  showEditExpenseAction(expense: Expense | null | undefined): boolean {
    return !!(expense && this.canEdit && canEditExpenseByWorkflowStatus(expense));
  }

  openExpenseEdit(): void {
    const e = this.expense;
    if (!e || !this.canEdit || !canEditExpenseByWorkflowStatus(e) || !this.canEditExpenseBasedOnReconciliation(e)) {
      return;
    }
    this.router.navigate(['/finance/expenses'], { state: { openEditExpensePayload: { ...e } } });
  }

  showDeleteExpenseAction(expense: Expense | null | undefined): boolean {
    return !!(expense && this.canDelete && canDeleteExpenseByWorkflowStatus(expense));
  }

  async openDeleteExpenseDialog(): Promise<void> {
    const e = this.expense;
    if (!e?.id || !this.canDelete || !canDeleteExpenseByWorkflowStatus(e)) {
      return;
    }
    if (this.reconciliationValidationService.requiresExpenseBankImpactCheck(e.paymentMethod)) {
      try {
        const status = await this.reconciliationValidationService.checkExpenseReconciliationStatus(e.id);
        this.expenseReconciliationCache.set(e.id, status);
        if (!status.canProceed) {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('cannot_edit_delete_expense_reconciliation_required'),
            life: 5000
          });
          return;
        }
      } catch (err) {
        console.error('Error checking reconciliation status:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_reconciliation_status'),
          life: 4000
        });
      }
    }
    this.deleteConfirmDialog = true;
  }

  cancelDeleteExpense(): void {
    this.deleteConfirmDialog = false;
  }

  confirmDeleteExpense(): void {
    const id = this.expense?.id;
    if (!id) {
      return;
    }
    this.isDeleteConfirmLoading = true;
    this.expenseService.deleteExpense(id).subscribe({
      next: () => {
        this.isDeleteConfirmLoading = false;
        this.deleteConfirmDialog = false;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('expense_deleted'),
          life: 3000
        });
        this.router.navigate(['/finance/expenses']);
      },
      error: (err: any) => {
        this.isDeleteConfirmLoading = false;
        const errorMessage = err?.error?.message || err?.message || '';
        const errorLower = String(errorMessage).toLowerCase();
        if (
          errorLower.includes('reconciled') ||
          errorLower.includes('reconciliation') ||
          errorLower.includes('bank transaction')
        ) {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('cannot_edit_delete_expense_reconciliation_required'),
            life: 5000
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_deleting_expense'),
            life: 3000
          });
        }
      }
    });
  }

  getDeleteConfirmationLabel(): string {
    const e = this.expense;
    if (!e) {
      return '';
    }
    const purpose = e.purpose != null ? String(e.purpose).trim() : '';
    if (purpose) {
      return purpose;
    }
    return this.getExpenseDisplayReference();
  }

  hasExpenseApprovalRole(): boolean {
    const r = this.userRoles || [];
    return r.includes('ADMIN') || r.includes('ACCOUNTANT') || r.includes('WAREHOUSEMAN');
  }

  canApproveExpense(): boolean {
    const e = this.expense;
    if (!e || e.status !== 'PENDING') {
      return false;
    }
    if (!this.hasExpenseApprovalRole()) {
      return false;
    }
    if (this.isAdmin) {
      return true;
    }
    if (this.userShopId == null || e.shop?.shopId == null) {
      return false;
    }
    return Number(e.shop.shopId) === Number(this.userShopId);
  }

  canRejectExpense(): boolean {
    return this.canApproveExpense();
  }

  canUploadAttachments(): boolean {
    const e = this.expense;
    if (!e) {
      return false;
    }
    if (e.status === 'REJECTED') {
      return false;
    }
    return true;
  }

  openApproveDialog(): void {
    this.approveConfirmDialog = true;
  }

  confirmApprove(): void {
    if (!this.expense?.id) {
      return;
    }
    this.isApprovalActionLoading = true;
    this.expenseService.approveExpense(this.expense.id).subscribe({
      next: () => {
        this.isApprovalActionLoading = false;
        this.approveConfirmDialog = false;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('expense_approved_success'),
          life: 3000
        });
        this.loadExpense();
      },
      error: (err: any) => {
        this.isApprovalActionLoading = false;
        const msg = err?.error?.message || err?.message || this.translate.instant('expense_approve_error');
        const severity = err?.status === 403 ? 'error' : err?.status === 409 ? 'warn' : 'error';
        this.messageService.add({ severity, summary: this.translate.instant('error'), detail: msg, life: 5000 });
      }
    });
  }

  openRejectDialog(): void {
    this.rejectionReason = '';
    this.rejectConfirmDialog = true;
  }

  confirmReject(): void {
    if (!this.expense?.id) {
      return;
    }
    this.isApprovalActionLoading = true;
    this.expenseService.rejectExpense(this.expense.id, this.rejectionReason || undefined).subscribe({
      next: () => {
        this.isApprovalActionLoading = false;
        this.rejectConfirmDialog = false;
        this.rejectionReason = '';
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('expense_rejected_success'),
          life: 3000
        });
        this.loadExpense();
      },
      error: (err: any) => {
        this.isApprovalActionLoading = false;
        const msg = err?.error?.message || err?.message || this.translate.instant('expense_reject_error');
        const severity = err?.status === 403 ? 'error' : err?.status === 409 ? 'warn' : 'error';
        this.messageService.add({ severity, summary: this.translate.instant('error'), detail: msg, life: 5000 });
      }
    });
  }

  trackAttachmentById(_index: number, att: ExpenseAttachment): number {
    return att.id;
  }

  attachmentDisplayName(att: ExpenseAttachment): string {
    const raw = att.originalFilename?.trim();
    if (raw) {
      return raw;
    }
    const url = att.fileUrl || '';
    const seg = url.split('/').pop() || url;
    const base = seg.split(/[?#]/)[0];
    try {
      return decodeURIComponent(base);
    } catch {
      return base;
    }
  }

  isImageAttachment(att: ExpenseAttachment): boolean {
    const ct = (att.contentType || '').toLowerCase();
    if (ct.startsWith('image/')) {
      return true;
    }
    const name = (att.originalFilename || att.fileUrl || '').toLowerCase();
    return /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)(\?|#|$)/.test(name);
  }

  isPdfAttachment(att: ExpenseAttachment): boolean {
    const ct = (att.contentType || '').toLowerCase();
    if (ct.includes('pdf')) {
      return true;
    }
    return /\.pdf(\?|#|$)/i.test(att.originalFilename || att.fileUrl || '');
  }

  attachmentKindLabelKey(att: ExpenseAttachment): string {
    if (this.isPdfAttachment(att)) {
      return 'expense_attachment_kind_pdf';
    }
    if (this.isImageAttachment(att)) {
      return 'expense_attachment_kind_image';
    }
    return 'expense_attachment_kind_document';
  }

  showNonImageAttachmentThumb(att: ExpenseAttachment): boolean {
    return !this.isImageAttachment(att);
  }

  showAttachmentImageThumbLoading(att: ExpenseAttachment): boolean {
    if (!this.isImageAttachment(att) || att.id == null) {
      return false;
    }
    return this.getAttachmentLoadState(att.id) === 'loading';
  }

  showAttachmentImageThumbImage(att: ExpenseAttachment): boolean {
    if (!this.isImageAttachment(att) || att.id == null) {
      return false;
    }
    if (this.getAttachmentLoadState(att.id) !== 'ready' || !this.attachmentBlobUrlById[att.id]) {
      return false;
    }
    return !this.attachmentThumbErrors[att.id];
  }

  showAttachmentImageThumbFallback(att: ExpenseAttachment): boolean {
    if (!this.isImageAttachment(att) || att.id == null) {
      return false;
    }
    const st = this.getAttachmentLoadState(att.id);
    if (st === 'loading') {
      return false;
    }
    if (st === 'error') {
      return true;
    }
    return st === 'ready' && !!this.attachmentThumbErrors[att.id];
  }

  onAttachmentThumbError(id: number): void {
    this.attachmentThumbErrors[id] = true;
  }

  openAttachmentImagePreview(att: ExpenseAttachment): void {
    if (att.id == null) {
      return;
    }
    const url = this.attachmentBlobUrlById[att.id];
    if (!url) {
      return;
    }
    this.attachmentImagePreviewUrl = url;
    this.attachmentImagePreviewVisible = true;
  }

  closeAttachmentImagePreview(): void {
    this.attachmentImagePreviewVisible = false;
    this.attachmentImagePreviewUrl = '';
  }

  openAttachmentInNewTab(att: ExpenseAttachment): void {
    if (att.id == null) {
      return;
    }
    const url = this.attachmentBlobUrlById[att.id];
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  downloadExpenseAttachment(att: ExpenseAttachment): void {
    if (att.id == null) {
      return;
    }
    const url = this.attachmentBlobUrlById[att.id];
    if (!url) {
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = this.attachmentDisplayName(att);
    a.rel = 'noopener';
    a.click();
  }

  openAttachmentPreviewUrlInNewTab(): void {
    const url = this.attachmentImagePreviewUrl;
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  onAttachmentFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.expense?.id) {
      return;
    }
    if (this.expense.attachments && this.expense.attachments.length >= this.maxAttachments) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('expense_attachment_max_count'),
        life: 4000
      });
      return;
    }
    if (file.size > this.maxAttachmentBytes) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('expense_attachment_file_too_large'),
        life: 5000
      });
      return;
    }
    this.attachmentUploading = true;
    this.expenseService.uploadExpenseAttachment(this.expense.id, file).subscribe({
      next: () => {
        this.attachmentUploading = false;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('expense_attachment_uploaded'),
          life: 3000
        });
        this.loadExpense();
      },
      error: (err: any) => {
        this.attachmentUploading = false;
        const msg = err?.error?.message || err?.message || this.translate.instant('expense_attachment_upload_failed');
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: msg,
          life: 5000
        });
      }
    });
  }

  deleteAttachment(att: ExpenseAttachment): void {
    if (!this.expense?.id || !att?.id) {
      return;
    }
    this.expenseService.deleteExpenseAttachment(this.expense.id, att.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('expense_attachment_deleted'),
          life: 3000
        });
        this.loadExpense();
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.message || this.translate.instant('error');
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: msg,
          life: 5000
        });
      }
    });
  }

  attachmentIcon(contentType: string | undefined): string {
    const c = (contentType || '').toLowerCase();
    if (c.includes('pdf')) {
      return 'pi pi-file-pdf';
    }
    if (c.startsWith('image/') || c.includes('image')) {
      return 'pi pi-image';
    }
    if (c.includes('spreadsheet') || c.includes('excel') || c.includes('ms-excel')) {
      return 'pi pi-file-excel';
    }
    if (c.includes('wordprocessing') || c.includes('msword')) {
      return 'pi pi-file-word';
    }
    return 'pi pi-file';
  }

  generateExpenseEvents(): void {
    if (!this.expense) {
      this.expenseEvents = [];
      return;
    }
    const e = this.expense;
    const st = String(e.status || '').toUpperCase();
    const events: ExpenseTimelineEvent[] = [];

    if (e.creationDate) {
      events.push({
        key: 'created',
        labelKey: 'expense_event_created',
        date: e.creationDate,
        icon: 'pi pi-plus-circle',
        markerClass: 'status-recorded',
        sortOrder: 10
      });
    }

    const creIso = this.pickExpenseInstantIso(e.creationDate);
    const subIso = this.pickExpenseInstantIso(e.submissionDate);
    if (subIso && subIso !== creIso) {
      events.push({
        key: 'submitted',
        labelKey: 'expense_event_submitted',
        date: e.submissionDate as Date | string,
        icon: 'pi pi-send',
        markerClass: 'status-pending',
        sortOrder: 20
      });
    }

    if (st === 'PENDING') {
      const pendingWhen =
        e.submissionDate || e.creationDate || e.lastUpdated || e.dateOfExpense;
      if (pendingWhen) {
        events.push({
          key: 'pending',
          labelKey: 'expense_status_pending',
          date: pendingWhen as Date | string,
          icon: 'pi pi-clock',
          markerClass: 'status-pending',
          sortOrder: 30
        });
      }
    }

    if (st === 'APPROVED') {
      const explicitApproval = e.approvedDate || e.approvalDate;
      const approvalWhen =
        explicitApproval ||
        this.getAutomaticApprovalReferenceDateIso(e) ||
        e.dateOfExpense ||
        e.creationDate ||
        e.lastUpdated;
      const manual = this.hasManualApprovalDetails(e);
      events.push({
        key: 'approved',
        labelKey: manual ? 'expense_approved_event' : 'expense_approved_event_automatic',
        date: approvalWhen as Date | string | undefined,
        icon: manual ? 'pi pi-check-circle' : 'pi pi-bolt',
        by: e.approvedBy || undefined,
        markerClass: 'status-approved',
        sortOrder: 40
      });

      if (e.reimbursementDate) {
        events.push({
          key: 'reimbursed',
          labelKey: 'expense_reimbursed_event',
          date: e.reimbursementDate as Date | string,
          icon: 'pi pi-wallet',
          by: e.reimbursedBy || undefined,
          markerClass: 'status-reimbursed',
          sortOrder: 50
        });
      }
    }

    if (st === 'REJECTED') {
      const rejectedWhen =
        e.rejectedDate ||
        e.lastUpdated ||
        e.submissionDate ||
        e.creationDate ||
        e.dateOfExpense;
      events.push({
        key: 'rejected',
        labelKey: 'expense_rejected_event',
        date: rejectedWhen as Date | string | undefined,
        icon: 'pi pi-times-circle',
        by: e.rejectedBy || undefined,
        reason: e.rejectionReason || undefined,
        markerClass: 'status-rejected',
        sortOrder: 40
      });
    }

    events.sort((a, b) => {
      const ma = this.expenseTimelineSortMs(a.date, a.sortOrder);
      const mb = this.expenseTimelineSortMs(b.date, b.sortOrder);
      if (ma !== mb) {
        return ma - mb;
      }
      return a.sortOrder - b.sortOrder;
    });

    this.expenseEvents = events;
  }

  isExpenseTimelineCurrent(index: number): boolean {
    if (!this.expense || index !== this.expenseEvents.length - 1) {
      return false;
    }
    return String(this.expense.status || '').toUpperCase() === 'PENDING';
  }

  private pickExpenseInstantIso(v: Date | string | undefined | null): string | undefined {
    if (v == null || v === '') {
      return undefined;
    }
    if (typeof v === 'string') {
      return v;
    }
    if (v instanceof Date && !isNaN(v.getTime())) {
      return v.toISOString();
    }
    return undefined;
  }

  /** Sort key: chronological; undated steps use sortOrder so order stays predictable. */
  private expenseTimelineSortMs(date: Date | string | undefined, sortOrder: number): number {
    if (date == null || date === '') {
      return Number.MAX_SAFE_INTEGER - 1000 + sortOrder;
    }
    const t = new Date(date as string | Date).getTime();
    return isNaN(t) ? Number.MAX_SAFE_INTEGER - 1000 + sortOrder : t;
  }

  getExpenseStatusBadgeClass(status: string | undefined): string {
    if (!status) {
      return 'expense-badge';
    }
    const suffix = String(status).toLowerCase().replace(/\s+/g, '_');
    return `expense-badge expense-${suffix}`;
  }

  /** True when the API returned approver / approval time for an approved expense. */
  hasManualApprovalDetails(expense: Expense | null | undefined): boolean {
    if (!expense || String(expense.status).toUpperCase() !== 'APPROVED') {
      return false;
    }
    const notes = (expense.approvalNotes || '').trim();
    return !!(expense.approvedBy || expense.approvedDate || expense.approvalDate || notes);
  }

  /** Best-effort timestamp to show under automatic approval (submission, last update, or creation). */
  getAutomaticApprovalReferenceDateIso(expense: Expense | null | undefined): string | undefined {
    if (!expense) {
      return undefined;
    }
    const pick = (v: Date | string | undefined): string | undefined => {
      if (v == null || v === '') {
        return undefined;
      }
      if (typeof v === 'string') {
        return v;
      }
      if (v instanceof Date && !isNaN(v.getTime())) {
        return v.toISOString();
      }
      return undefined;
    };
    return (
      pick(expense.submissionDate as Date | string | undefined) ||
      pick(expense.lastUpdated as Date | string | undefined) ||
      pick(expense.creationDate as Date | string | undefined)
    );
  }

  getPaymentMethodSeverity(method: string): string {
    return getPaymentMethodSeverity(method);
  }

  getPaymentMethodIcon(method: string): string {
    return getPaymentMethodIcon(method);
  }

  getPaymentMethodSeverityTag(method: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    const severityMap: { [key: string]: 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined } = {
      Cash: 'success',
      Card: 'info',
      Transfer: 'secondary',
      Check: 'warn',
      BOE: 'contrast'
    };
    return severityMap[method] || 'secondary';
  }

  hasExpensePaymentMethodDetails(): boolean {
    return !!(this.expense?.checkNumber || this.expense?.boeNumber ||
      this.expense?.checkExpirationDate ||
      this.expense?.boeExpirationDate);
  }

  duplicateExpense(expense: Expense): void {
    console.log('Duplicate expense:', expense);
  }

  formatDateTime(iso: string | undefined): string {
    if (!iso) {
      return '—';
    }
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) {
        return String(iso);
      }
      return formatDate(d, 'medium', this.dateLocale);
    } catch {
      return String(iso);
    }
  }

  /** Maps app language codes to Angular `DatePipe` / `formatDate` locale ids (see main.ts registerLocaleData). */
  private mapAppLangToDateLocale(lang: string | undefined): string {
    const l = (lang || 'en').toLowerCase().split('-')[0];
    const map: Record<string, string> = { en: 'en', fr: 'fr', es: 'es', ar: 'ar' };
    return map[l] || 'en';
  }

  /** Human-readable expense code from API; falls back to #id for legacy data. */
  getAttachmentCount(): number {
    return this.expense?.attachments?.length ?? 0;
  }

  getExpenseDisplayReference(): string {
    const e = this.expense;
    if (!e) {
      return '—';
    }
    const ref = e.reference != null ? String(e.reference).trim() : '';
    if (ref) {
      return ref;
    }
    return e.id != null ? `#${e.id}` : '—';
  }
}
