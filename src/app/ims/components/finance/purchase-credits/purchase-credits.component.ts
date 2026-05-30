import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService, LazyLoadEvent } from 'primeng/api';
import { Table } from 'primeng/table';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { PurchaseCredit } from 'src/app/models/purchaseCredit';
import { PurchaseCreditService } from 'src/app/services/purchase-credit.service';
import { PurchaseReturnService } from 'src/app/services/purchase-return.service';
import { PurchaseReturn } from 'src/app/models/purchaseReturn';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { BankAccount } from 'src/app/models/bank-account';
import { PaymentValidationService } from 'src/app/services/payment-validation.service';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { DatePipe } from '@angular/common';
import { SupplierService } from 'src/app/services/supplier.service';
import { Supplier } from 'src/app/models/supplier';
import { firstValueFrom } from 'rxjs';
import { getPaymentMethodIcon as paymentMethodIconFromUtils } from 'src/app/shared/payment-utils';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';

interface LazyLoadEventExt extends LazyLoadEvent {
  globalFilter?: string;
  filters?: { [field: string]: any };
}

@Component({
  templateUrl: './purchase-credits.component.html',
  styleUrls: ['./purchase-credits.component.css', '../finance.component.css'],
  providers: [MessageService, DatePipe]
})
export class PurchaseCreditsComponent implements OnInit {

  Ressource: string = 'PURCHASE_CREDITS';

  creditDialog: boolean = false;
  deleteCreditDialog: boolean = false;
  deleteCreditsDialog: boolean = false;
  currency: any;
  maxCreditAmount: number = 0;
  eligibleReturns: PurchaseReturn[] = [];
  credits: PurchaseCredit[] = [];
  credit: PurchaseCredit = {};
  selectedCredits: PurchaseCredit[] = [];
  submitted: boolean = false;
  cols: any[] = [];
  rowsPerPageOptions = [20, 50, 100];
  exportColumns!: ExportColumn[];
  userRoles: any;
  isAdmin: boolean = false;
  /** Values must match backend RefundMethod / Jackson (Cash, Card, Check, Transfer, BOE, DIGITAL_WALLET) */
  creditMethods = [
    { value: 'Cash', label: 'credit_method_cash' },
    { value: 'Card', label: 'credit_method_card' },
    { value: 'Check', label: 'credit_method_check' },
    { value: 'Transfer', label: 'credit_method_transfer' },
    { value: 'BOE', label: 'credit_method_boe' },
    { value: 'DIGITAL_WALLET', label: 'credit_method_digital_wallet' },
  ];
  canAddCredit: boolean = false;
  canEditCredit: boolean = false;
  canDeleteCredit: boolean = false;
  canReadCredit: boolean = false;
  isLoading: boolean = true;
  creditStatuses: any[] = [];
  maxCreditDate: Date;
  bankAccounts: BankAccount[] = [];
  showBankAccountField: boolean = false;
  isBankAccountRequired: boolean = false;
  minimumAmountHint: string | null = null;

  // Filter properties
  selectedCreditStatus: string | null = null;
  selectedCreditMethod: string | null = null;
  selectedSupplier: any = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  showAdvancedFilters = false;
  suppliers: Supplier[] = []; // Unique suppliers from credits
  globalFilter: string = '';
  
  // Lazy loading properties
  totalRecords: number = 0;
  lastLazyLoadEvent: LazyLoadEventExt = {
    first: 0,
    rows: 20,
    sortField: 'creditDate',
    sortOrder: -1
  };
  
  isExporting: boolean = false;
  exportProgress: string = '';
  isPurchaseCreditsFeatureEnabled: boolean = true;

  constructor(
    private messageService: MessageService,
    private purchaseCreditService: PurchaseCreditService,
    private purchaseReturnService: PurchaseReturnService,
    private bankAccountService: BankAccountService,
    private configService: AppConfigurationService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private router: Router,
    private paymentValidationService: PaymentValidationService,
    private organizationService: OrganizationService,
    private supplierService: SupplierService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    private licenseCapabilitiesService: LicenseCapabilitiesService
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    this.maxCreditDate = new Date();
    this.maxCreditDate.setHours(23, 59, 59, 999);
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });
    await this.paymentValidationService.loadConfigurations();
    
    // Load data
    await Promise.all([
      this.onGetAllSuppliers(),
      this.loadBankAccounts(),
      this.setUserRoles(),
      this.checkPermissions(),
      this.loadLicenseCapabilities(),
    ]);
    this.cols = [
      { field: 'creditId', header: this.translateService.instant('ID') },
      { field: 'transactionId', header: this.translateService.instant('credit_transaction_id') },
      { field: 'purchaseReturn.purchase.reference', header: this.translateService.instant('purchase_reference') },
      { field: 'amount', header: this.translateService.instant('amount') },
      { field: 'status', header: this.translateService.instant('credit_status') },
      { field: 'creditMethod', header: this.translateService.instant('credit_method') },
      { field: 'creditDate', header: this.translateService.instant('credit_date') },
    ];
    this.creditStatuses = [
      { value: 'PENDING', label: 'credit_status_pending' },
      { value: 'SETTLED', label: 'credit_status_settled' },
      { value: 'FAILED', label: 'credit_status_failed' },
      { value: 'PARTIAL_REFUND', label: 'credit_status_partial_refund' }
    ];
    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
    
    // Load first page of credits
    await this.loadCredits();
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canAddCredit = this.permissionService.canCreate(this.Ressource);
    this.canEditCredit = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteCredit = this.permissionService.canDelete(this.Ressource);
    this.canReadCredit = this.permissionService.canRead(this.Ressource);
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  private async loadLicenseCapabilities(): Promise<void> {
    try {
      await this.licenseCapabilitiesService.ensureLoaded();
      this.isPurchaseCreditsFeatureEnabled = this.licenseCapabilitiesService.isFeatureEnabled('PURCHASE_CREDITS');
    } catch (error) {
      console.warn('Unable to resolve license capabilities for purchase credits.', error);
      this.isPurchaseCreditsFeatureEnabled = true;
    }
  }

  private showUpgradeRequired(detail: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Upgrade required',
      detail,
      life: 7000
    });
  }

  async loadBankAccounts() {
    try {
      const accounts$ = await this.bankAccountService.getBankAccounts(true);
      const response = await accounts$.toPromise();
      this.bankAccounts = response as BankAccount[];
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  }

  deleteSelectedCredits() {
    if (!this.canDeleteCredit) return;
    this.deleteCreditsDialog = true;
  }

  async editCredit(credit: PurchaseCredit) {
    if (!this.canEditCredit) return;
    await this.loadEligibleReturns();
    await this.loadBankAccounts();
    this.credit = { ...credit };
    await this.updateBankAccountFieldVisibility();
    this.creditDialog = true;
  }

  deleteCredit(credit: PurchaseCredit) {
    if (!this.canDeleteCredit) return;
    this.deleteCreditDialog = true;
    this.credit = { ...credit };
  }

  confirmDeleteSelected() {
    this.deleteCreditsDialog = false;
    this.selectedCredits.forEach(selectedCredit => this.onDeleteCredit(selectedCredit.creditId));
    this.selectedCredits = [];
  }

  async confirmDelete() {
    this.deleteCreditDialog = false;
    await this.onDeleteCredit(this.credit.creditId);
    this.credit = {};
  }

  hideDialog() {
    this.creditDialog = false;
    this.submitted = false;
  }

  async openNew() {
    if (!this.canAddCredit) return;
    if (!this.isPurchaseCreditsFeatureEnabled) {
      this.showUpgradeRequired('Purchase credits are not available on your current plan. Upgrade to continue.');
      return;
    }
    await this.loadEligibleReturns();
    await this.loadBankAccounts();
    this.credit = {};
    this.credit.creditDate = new Date();
    this.credit.creditMethod = 'Cash';
    this.credit.status = 'PENDING';
    this.submitted = false;
    await this.updateBankAccountFieldVisibility();
    this.creditDialog = true;
  }

  async onCreditMethodChange() {
    await this.updateBankAccountFieldVisibility();
  }

  async updateBankAccountFieldVisibility() {
    if (!this.credit.creditMethod) {
      this.showBankAccountField = false;
      this.isBankAccountRequired = false;
      this.minimumAmountHint = null;
      return;
    }

    this.showBankAccountField = await this.paymentValidationService.shouldShowBankAccountField(this.credit.creditMethod);
    this.isBankAccountRequired = await this.paymentValidationService.isBankAccountRequired(this.credit.creditMethod);
    this.minimumAmountHint = await this.paymentValidationService.getMinimumAmountHint(this.credit.creditMethod, this.currency);

    // Pre-populate bank account from shop's default if available
    if (this.showBankAccountField && this.credit.purchaseReturn?.purchase?.shop && !this.credit.bankAccountId) {
      const shopDefaultAccountId = this.credit.purchaseReturn.purchase.shop.defaultBankAccount?.accountId || 
                                    this.credit.purchaseReturn.purchase.shop.defaultBankAccountId;
      if (shopDefaultAccountId) {
        const defaultAccount = this.bankAccounts.find(acc => acc.accountId === shopDefaultAccountId);
        if (defaultAccount) {
          this.credit.bankAccountId = defaultAccount.accountId;
        }
      }
    }
  }

  isCreditValidForUpdate(credit: any): boolean {
    const today = new Date();
    const creditDate = new Date(credit.creditDate);
    return creditDate.toDateString() === today.toDateString();
  }

  getReturnDisplayLabel = (ret: PurchaseReturn): string => {
    if (!ret) { return ''; }
    const returnReference = ret.reference ?? 'N/A';
    const reference = ret.purchase?.reference ?? 'N/A';
    const creditAmt = ret.totalCreditableAmount ?? 0;
    const supplier = ret.purchase?.supplier?.name || 'N/A';
    return `#${returnReference} • ${this.translate.instant('purchase')} #${reference} • ${creditAmt} ${this.currency} • ${supplier}`;
  };

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Persisted rows may still use legacy uppercase strings; API expects RefundMethod names */
  private normalizeCreditMethodForApi(credit: PurchaseCredit): void {
    const m = credit.creditMethod;
    if (!m) {
      return;
    }
    const legacyToBackend: Record<string, string> = {
      CASH: 'Cash',
      CARD: 'Card',
      CHECK: 'Check',
      BANK_TRANSFER: 'Transfer',
      TRANSFER: 'Transfer',
      BOE: 'BOE',
      Boe: 'BOE',
    };
    const mapped = legacyToBackend[m];
    if (mapped) {
      credit.creditMethod = mapped;
    }
  }

  async saveCredit() {
    this.submitted = true;

    if (!this.credit.purchaseReturn) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    if (this.credit.amount <= 0 || this.credit.amount > this.maxCreditAmount) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('credit_amount_invalid')
      });
      return;
    }

    if (!this.credit.creditDate) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    if (!this.credit.creditMethod) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    if (
      (this.credit.creditMethod === 'CHECK' || this.credit.creditMethod === 'Check') &&
      (!this.credit.checkNumber || !this.credit.checkExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('check_fields_required')
      });
      return;
    }

    if (
      (this.credit.creditMethod === 'BOE' || this.credit.creditMethod === 'Boe') &&
      (!this.credit.boeNumber || !this.credit.boeExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('boe_fields_required')
      });
      return;
    }

    // Validate bank account and minimum amount using validation service
    const validation = await this.paymentValidationService.validateBankPayment(
      this.credit.creditMethod || '',
      this.credit.bankAccountId,
      this.credit.amount,
      'credit'
    );

    if (!validation.valid) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: validation.error || this.translate.instant('validation_error')
      });
      return;
    }

    if (this.credit.creditDate) {
      const date = typeof this.credit.creditDate === 'string' ? new Date(this.credit.creditDate) : this.credit.creditDate;
      this.credit.creditDate = this.formatDate(date);
    }

    if (this.credit.checkExpirationDate) {
      const date = typeof this.credit.checkExpirationDate === 'string' ? new Date(this.credit.checkExpirationDate) : this.credit.checkExpirationDate;
      this.credit.checkExpirationDate = this.formatDate(date);
    }

    if (this.credit.boeExpirationDate) {
      const date = typeof this.credit.boeExpirationDate === 'string' ? new Date(this.credit.boeExpirationDate) : this.credit.boeExpirationDate;
      this.credit.boeExpirationDate = this.formatDate(date);
    }

    if (this.credit.purchaseReturn) {
      this.normalizeCreditMethodForApi(this.credit);
      let success = false;
      if (this.credit.creditId) {
        success = await this.updateCredit(this.credit.creditId, this.credit);
      } else {
        success = await this.addCredit(this.credit);
      }
      if (success) {
        this.credits = [...this.credits];
        this.creditDialog = false;
        this.credit = {};
      }
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
    }
  }

  @ViewChild('dt') dt!: Table;

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.globalFilter = value;

    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      globalFilter: this.globalFilter
    };

    this.onLazyLoad(lazyEvent);
  }

  async onGetAllSuppliers() {
    try {
      const response = await firstValueFrom(this.supplierService.getSuppliers()) as Supplier[];
      this.suppliers = response;
    } catch (err: any) {
      console.error('Error loading suppliers:', err);
    }
  }

  loadUniqueSuppliers() {
    const supplierMap = new Map();
    this.credits.forEach(credit => {
      if (credit.purchaseReturn?.purchase?.supplier) {
        const supplier = credit.purchaseReturn.purchase.supplier;
        if (!supplierMap.has(supplier.supplierId)) {
          supplierMap.set(supplier.supplierId, supplier);
        }
      }
    });
    // Merge with existing suppliers list
    const existingSupplierIds = new Set(this.suppliers.map(s => s.supplierId));
    Array.from(supplierMap.values()).forEach(supplier => {
      if (!existingSupplierIds.has(supplier.supplierId)) {
        this.suppliers.push(supplier);
      }
    });
  }

  applyFilters() {
    // Build filters object in the format expected by the service
    // Service expects: { field: { value: ..., matchMode: ... } }
    const filters: any = {};
    
    if (this.selectedCreditStatus) {
      filters.status = { value: this.selectedCreditStatus, matchMode: 'equals' };
    }
    if (this.selectedCreditMethod) {
      filters.creditMethod = { value: this.selectedCreditMethod, matchMode: 'equals' };
    }
    if (this.selectedSupplier) {
      // Pass the full supplier object - the service will extract supplierId from it
      filters.supplierId = { value: this.selectedSupplier, matchMode: 'equals' };
    }
    if (this.startDate) {
      filters.fromDate = { value: this.startDate, matchMode: 'equals' };
    }
    if (this.endDate) {
      filters.toDate = { value: this.endDate, matchMode: 'equals' };
    }

    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      filters: filters
    };

    this.updateLastLazyLoadEvent(lazyEvent);
    this.loadCredits();
  }

  onFilterChange() {
    // Apply filters immediately when filter values change
    this.applyFilters();
  }

  clearFilters() {
    this.selectedCreditStatus = null;
    this.selectedCreditMethod = null;
    this.selectedSupplier = null;
    this.startDate = null;
    this.endDate = null;
    this.globalFilter = '';

    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      globalFilter: '',
      filters: {}
    };

    this.onLazyLoad(lazyEvent);
  }

  clear(table: Table) {
    table.clear();
  }

  onLazyLoad(event: LazyLoadEvent) {
    const extendedEvent: LazyLoadEventExt = {
      ...event,
      globalFilter: this.globalFilter
    };

    this.updateLastLazyLoadEvent(extendedEvent);
    this.loadCredits();
  }

  updateLastLazyLoadEvent(event: LazyLoadEventExt) {
    this.lastLazyLoadEvent = {
      first: event.first || 0,
      rows: event.rows || 20,
      sortField: event.sortField || 'creditDate',
      sortOrder: event.sortOrder || -1,
      globalFilter: event.globalFilter || this.globalFilter,
      filters: event.filters || this.lastLazyLoadEvent.filters || {}
    };
  }

  loadCredits() {
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;

    const page = first! / rows!;
    const size = rows!;
    const direction = sortOrder === -1 ? 'ASC' : 'DESC';
    
    // Pass filters as-is - the service expects { field: { value: ..., matchMode: ... } } format
    const filterPayload = filters || {};

    console.log('Loading credits with parameters:', {
      page,
      size,
      sortField,
      direction,
      globalFilter,
      filters: filterPayload
    });

    this.purchaseCreditService.getCreditsPaginated(
      page,
      size,
      globalFilter || '',
      sortField!,
      direction,
      filterPayload
    ).subscribe({
      next: (res: any) => {
        console.log('Paginated credits response:', res);
        // Assign the paginated credits
        this.credits = res.page.content.map((c: any) => {
          // Normalize purchaseCreditId to creditId for consistency
          if (c.purchaseCreditId && !c.creditId) {
            c.creditId = c.purchaseCreditId;
          }
          return {
            ...c,
            creationDate: c.creationDate ? new Date(c.creationDate) : null,
            creditDate: c.creditDate ? new Date(c.creditDate) : null,
            checkExpirationDate: c.checkExpirationDate ? new Date(c.checkExpirationDate) : null,
            boeExpirationDate: c.boeExpirationDate ? new Date(c.boeExpirationDate) : null
          };
        });

        // Assign total records from backend
        this.totalRecords = res.page?.totalElements || res.totalCredits || 0;

        // Load unique suppliers from credits
        this.loadUniqueSuppliers();

        this.isLoading = false;
        
        // Trigger change detection to ensure table updates
        if (this.cdr) {
          this.cdr.detectChanges();
        }
      },
      error: (err: any) => {
        console.error(err);
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_credits'),
          life: 3000
        });
      }
    });
  }

  // Keep this method for backward compatibility but make it call loadCredits
  async onGetAllCredits() {
    this.loadCredits();
  }

  async onDeleteCredit(id: any) {
    await this.purchaseCreditService.deleteCredit(id).subscribe({
      next: (response: any) => {
        this.loadCredits();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('credit_deleted'),
          life: 3000
        });
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_deleting_credit'),
          life: 3000
        });
      },
    });
  }

  async updateCredit(id: any, credit: any): Promise<any> {
    await this.purchaseCreditService.updateCredit(id, credit).subscribe({
      next: (response: any) => {
        this.loadCredits();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('credit_updated'),
          life: 3000
        });
        return true;
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_updating_credit'),
          life: 3000
        });
        return false;
      },
    });
  }

  addCredit(credit: any): Promise<boolean> {
    return new Promise((resolve) => {
      this.purchaseCreditService.saveCredit(credit).subscribe({
        next: () => {
          this.loadCredits();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('credit_added'),
            life: 3000
          });
          resolve(true);
        },
        error: (err: any) => {
          console.error('Error adding credit:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_credit'),
            life: 3000
          });
          resolve(false);
        }
      });
    });
  }

  async loadEligibleReturns() {
    this.purchaseReturnService.getReturnsReadyForCredit().subscribe((returns: PurchaseReturn[]) => {
      this.eligibleReturns = returns.filter(r => r.totalCreditableAmount > 0);
    });
  }

  compareReturns = (o1: PurchaseReturn, o2: PurchaseReturn): boolean =>
    o1 && o2 ? o1.returnId === o2.returnId : o1 === o2;

  async onReturnSelect(selectedReturn: PurchaseReturn) {
    if (!selectedReturn) {
      this.maxCreditAmount = 0;
      return;
    }
    const totalCreditable = selectedReturn.totalCreditableAmount || 0;
    const totalAlreadyCredited = selectedReturn.credits?.reduce((sum, credit) => {
      return sum + (credit.amount || 0);
    }, 0) || 0;
    this.maxCreditAmount = totalCreditable - totalAlreadyCredited;
    if (this.credit.amount > this.maxCreditAmount) {
      this.credit.amount = this.maxCreditAmount;
    }

    // Update bank account field visibility and pre-populate from shop default if credit method is already selected
    if (this.credit.creditMethod) {
      await this.updateBankAccountFieldVisibility();
    }
  }

  async exportPdf() {
    if (this.isExporting) {
      return; // Prevent multiple simultaneous exports
    }

    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      
      // Show initial loading message
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('exporting'),
        detail: this.translate.instant('exporting_pdf_please_wait') || 'Exporting PDF, please wait...',
        life: 3000
      });

      // Fetch all filtered credits from backend using pagination
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredCredits: any[] = [];
      let currentPage = 0;
      const pageSize = 1000;
      const maxPages = 100; // Safety limit
      
      while (currentPage < maxPages) {
        const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
        const direction = sortOrder === -1 ? 'ASC' : 'DESC';
        const filterPayload = filters || {};

        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1})...` || `Fetching data (${currentPage + 1})...`;

        const response = await firstValueFrom(
          this.purchaseCreditService.getCreditsPaginated(
            currentPage,
            pageSize,
            globalFilter || '',
            sortField!,
            direction,
            filterPayload
          )
        );

        const pageContent = response.page?.content || [];
        if (pageContent.length === 0) {
          break; // No more data
        }

        allFilteredCredits = [...allFilteredCredits, ...pageContent];

        // Check if there are more pages
        const totalElements = response.page?.totalElements || 0;
        if (allFilteredCredits.length >= totalElements) {
          break; // All data fetched
        }

        currentPage++;
      }

      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';
      
      // Load token and get organization's default locale
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      // Build translated export columns based on organization's default locale
      const translationKeyMap: { [key: string]: string } = {
        'transactionId': 'credit_transaction_id',
        'purchaseReturn.purchase.reference': 'purchase_reference',
        'amount': 'amount',
        'status': 'credit_status',
        'creditMethod': 'credit_method',
        'creditDate': 'credit_date'
      };
      
      const translatedExportColumns: ExportColumn[] = this.exportColumns
        .filter((col) => col.dataKey !== 'creditId') // Exclude ID column
        .map((col) => {
          const translationKey = translationKeyMap[col.dataKey] || col.dataKey;
          return {
            title: this.translate.instant(translationKey),
            dataKey: col.dataKey
          };
        });
      
      // Prepare data for export
      const exportData = allFilteredCredits.map(credit => {
        const exportCredit: any = {
          transactionId: credit.transactionId || 'N/A',
          'purchaseReturn.purchase.reference': credit.purchaseReturn?.purchase?.reference || 'N/A',
          amount: credit.amount || 0,
          status: this.translate.instant(`credit_status_${credit.status?.toLowerCase()}`) || credit.status,
          creditMethod: this.translate.instant(`credit_method_${credit.creditMethod?.toLowerCase()}`) || credit.creditMethod,
          creditDate: credit.creditDate ? this.datePipe.transform(credit.creditDate, 'dd/MM/yyyy') : 'N/A'
        };
        return exportCredit;
      });
      
      // Get translated title for PDF
      const pdfTitle = this.translate.instant('purchase_credits_menu_title') || this.translate.instant('purchase_credits');
      
      // Export with translated headers and title
      this.reportingService.exportPdf(translatedExportColumns, exportData, 'purchase-credits', pdfTitle);
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredCredits.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_exporting') || 'Error exporting PDF',
        life: 5000
      });
    } finally {
      this.isExporting = false;
      this.exportProgress = '';
    }
  }

  async exportExcel() {
    if (this.isExporting) {
      return; // Prevent multiple simultaneous exports
    }

    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      
      // Show initial loading message
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('exporting'),
        detail: this.translate.instant('exporting_excel_please_wait') || 'Exporting Excel, please wait...',
        life: 3000
      });

      // Fetch all filtered credits from backend using pagination
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredCredits: any[] = [];
      let currentPage = 0;
      const pageSize = 1000;
      const maxPages = 100; // Safety limit
      
      while (currentPage < maxPages) {
        const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
        const direction = sortOrder === -1 ? 'ASC' : 'DESC';
        const filterPayload = filters || {};

        this.exportProgress = `${this.translate.instant('fetching_data')} (${currentPage + 1})...` || `Fetching data (${currentPage + 1})...`;

        const response = await firstValueFrom(
          this.purchaseCreditService.getCreditsPaginated(
            currentPage,
            pageSize,
            globalFilter || '',
            sortField!,
            direction,
            filterPayload
          )
        );

        const pageContent = response.page?.content || [];
        if (pageContent.length === 0) {
          break; // No more data
        }

        allFilteredCredits = [...allFilteredCredits, ...pageContent];

        // Check if there are more pages
        const totalElements = response.page?.totalElements || 0;
        if (allFilteredCredits.length >= totalElements) {
          break; // All data fetched
        }

        currentPage++;
      }

      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';
      
      // Load token and get organization's default locale
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      // Map column field names to translation keys
      const translationKeyMap: { [key: string]: string } = {
        'transactionId': 'credit_transaction_id',
        'purchaseReturn.purchase.reference': 'purchase_reference',
        'amount': 'amount',
        'status': 'credit_status',
        'creditMethod': 'credit_method',
        'creditDate': 'credit_date'
      };
      
      // Create translated version of the data with translated headers
      const translatedCredits = allFilteredCredits.map(credit => {
        const translated: any = {};
        this.cols.forEach(col => {
          // Exclude creationDate and ID columns
          if (col.field !== 'creationDate' && col.field !== 'creditId') {
            const translationKey = translationKeyMap[col.field] || col.field;
            const translatedHeader = this.translate.instant(translationKey);
            
            let value: any = credit[col.field as keyof PurchaseCredit];
            
            // Handle nested fields
            if (col.field === 'purchaseReturn.purchase.reference') {
              value = credit.purchaseReturn?.purchase?.reference || 'N/A';
            } else if (col.field === 'status') {
              value = this.translate.instant(`credit_status_${value?.toLowerCase()}`) || value;
            } else if (col.field === 'creditMethod') {
              value = this.translate.instant(`credit_method_${value?.toLowerCase()}`) || value;
            } else if (col.field === 'creditDate') {
              value = value ? this.datePipe.transform(value, 'dd/MM/yyyy') : 'N/A';
            }
            
            translated[translatedHeader] = value;
          }
        });
        return translated;
      });

      // Export the translated array to Excel
      this.reportingService.exportExcel(translatedCredits, 'purchase-credits');
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${allFilteredCredits.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_exporting') || 'Error exporting Excel',
        life: 5000
      });
    } finally {
      this.isExporting = false;
      this.exportProgress = '';
    }
  }

  getCreditedAmount(purchaseReturn: PurchaseReturn): number {
    if (!purchaseReturn.credits || purchaseReturn.credits.length === 0) return 0;
    return purchaseReturn.credits.reduce((sum, credit) => sum + (credit.amount || 0), 0);
  }

  getStatusSeverity(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'PROCESSING': return 'info';
      case 'PENDING': return 'warning';
      case 'FAILED': return 'danger';
      default: return '';
    }
  }

  getCreditMethodLabel(method: string): string {
    return {
      Check: 'credit_method_check',
      Card: 'credit_method_card',
      Transfer: 'credit_method_transfer',
      Cash: 'credit_method_cash',
      BOE: 'credit_method_boe',
      DIGITAL_WALLET: 'credit_method_digital_wallet',
      // Legacy persisted values
      CHECK: 'credit_method_check',
      CASH: 'credit_method_cash',
      BANK_TRANSFER: 'credit_method_transfer',
      CREDIT_NOTE: 'credit_method_credit_note',
    }[method] || method;
  }

  getTotalAmount(): number {
    return this.credits?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
  }

  getPaymentMethodIcon(method: string): string {
    return paymentMethodIconFromUtils(method);
  }

  getPaymentMethodSeverity(method: string): string {
    switch (method?.toLowerCase()) {
      case 'cash': return 'success';
      case 'card': return 'info';
      case 'transfer': return 'warning';
      case 'check': return 'help';
      case 'boe': return 'help';
      default: return 'danger';
    }
  }

  showCreditDetails(credit: PurchaseCredit | any): void {
    if (!credit) {
      return;
    }
    // Handle both creditId and purchaseCreditId (backend may use different field names)
    const creditId = credit.creditId || credit.purchaseCreditId;
    if (!creditId && creditId !== 0) {
      console.warn('Purchase credit ID is missing:', credit);
      return;
    }
    this.router.navigate(['/finance/purchase-credits', creditId.toString()]);
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

  async confirmCredit(id: any) {
    await this.purchaseCreditService.confirmCredit(id).subscribe({
      next: (response: any) => {
        this.loadCredits();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('credit_confirmed'),
          life: 3000
        });
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_confirming_credit'),
          life: 3000
        });
      },
    });
  }
}

