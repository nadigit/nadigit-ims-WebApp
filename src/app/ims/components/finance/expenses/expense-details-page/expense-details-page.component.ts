import { Component, OnInit } from '@angular/core';
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
import { firstValueFrom } from 'rxjs';
import { getPaymentMethodIcon, getPaymentMethodSeverity } from 'src/app/shared/payment-utils';

@Component({
  selector: 'app-expense-details-page',
  templateUrl: './expense-details-page.component.html',
  styleUrls: ['./expense-details-page.component.css', '../expenses.component.css', '../../finance.component.css']
})
export class ExpenseDetailsPageComponent implements OnInit {
  expenseId!: number;
  expense: Expense | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  expenseEvents: any[] = [];

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

  attachmentUploading: boolean = false;
  readonly maxAttachmentBytes = 5 * 1024 * 1024;
  readonly maxAttachments = 10;

  private readonly apiProtocol: string = (window as any).__env?.apiProtocol || 'http';
  private readonly apiHost: string = (window as any).__env?.apiHost || 'localhost';
  private readonly apiPort: string = (window as any).__env?.apiPort || '8090';

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
    private translateService: TranslationService
  ) {}

  async ngOnInit() {
    this.isLoading = true;

    this.expenseService.loadToken();

    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
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

      this.generateExpenseEvents();
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

  resolveAttachmentUrl(att: ExpenseAttachment): string {
    const url = att?.fileUrl || '';
    if (!url) {
      return '';
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${path}`;
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
    if (c.includes('image')) {
      return 'pi pi-image';
    }
    return 'pi pi-file';
  }

  generateExpenseEvents() {
    if (!this.expense) {
      return;
    }
    const e = this.expense;
    this.expenseEvents = [];
    if (e.creationDate) {
      this.expenseEvents.push({
        key: 'created',
        labelKey: 'expense_event_created',
        date: e.creationDate,
        icon: 'pi pi-plus-circle'
      });
    }
    const st = String(e.status || '').toUpperCase();
    if (st === 'PENDING') {
      this.expenseEvents.push({
        key: 'pending',
        labelKey: 'expense_status_pending',
        date: e.creationDate,
        icon: 'pi pi-clock'
      });
    }
    if (st === 'APPROVED' || st === 'REJECTED') {
      const ad = e.approvedDate || e.approvalDate;
      if (st === 'APPROVED' && ad) {
        this.expenseEvents.push({
          key: 'approved',
          labelKey: 'expense_approved_event',
          date: ad,
          icon: 'pi pi-check-circle',
          by: e.approvedBy
        });
      }
      if (st === 'REJECTED') {
        this.expenseEvents.push({
          key: 'rejected',
          labelKey: 'expense_rejected_event',
          date: e.rejectedDate,
          icon: 'pi pi-times-circle',
          by: e.rejectedBy,
          reason: e.rejectionReason
        });
      }
    }
  }

  getExpenseStatusSeverityTag(status: string | undefined): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING') {
      return 'warn';
    }
    if (s === 'APPROVED') {
      return 'success';
    }
    if (s === 'REJECTED') {
      return 'danger';
    }
    return 'secondary';
  }

  getExpenseStatusIcon(status: string | undefined): string {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING') {
      return 'pi pi-clock';
    }
    if (s === 'APPROVED') {
      return 'pi pi-check-circle';
    }
    if (s === 'REJECTED') {
      return 'pi pi-times-circle';
    }
    return 'pi pi-info-circle';
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

  previewReceipt(receiptUrl: string): void {
    if (!receiptUrl) {
      return;
    }
    window.open(receiptUrl, '_blank');
  }

  printExpenseReceipt(expense: Expense): void {
    console.log('Print expense receipt:', expense);
  }

  exportExpenseToPDF(expense: Expense): void {
    console.log('Export expense to PDF:', expense);
  }

  uploadReceipt(expense: Expense): void {
    console.log('Upload receipt for expense:', expense);
  }

  duplicateExpense(expense: Expense): void {
    console.log('Duplicate expense:', expense);
  }

  formatDateTime(iso: string | undefined): string {
    if (!iso) {
      return '—';
    }
    try {
      return new Date(iso).toLocaleString(this.translate.currentLang || 'en');
    } catch {
      return iso;
    }
  }
}
