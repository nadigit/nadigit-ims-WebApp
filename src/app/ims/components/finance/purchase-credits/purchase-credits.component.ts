import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
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

@Component({
  templateUrl: './purchase-credits.component.html',
  styleUrls: ['./purchase-credits.component.css', '../finance.component.css'],
  providers: [MessageService]
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
  creditMethods = [
    { value: 'Cash', label: 'credit_method_cash' },
    { value: 'Card', label: 'credit_method_card' },
    { value: 'Check', label: 'credit_method_check' },
    { value: 'BOE', label: 'credit_method_boe' },
    { value: 'Transfer', label: 'credit_method_transfer' },
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
  suppliers: any[] = []; // Unique suppliers from credits
  globalFilter: string = '';

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
    private paymentValidationService: PaymentValidationService
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
    this.onGetAllCredits();
    await this.loadBankAccounts();
    await this.setUserRoles();
    await this.checkPermissions();
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
      { value: 'PROCESSING', label: 'credit_status_processing' },
      { value: 'COMPLETED', label: 'credit_status_completed' }
    ];
    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
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
      this.credit.creditMethod === 'Check' &&
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
      this.credit.creditMethod === 'BOE' &&
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
    if (this.dt) {
      this.dt.filterGlobal(value, 'contains');
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
    this.suppliers = Array.from(supplierMap.values());
  }

  onFilterChange() {
    if (this.dt) {
      const filters: any = {};

      if (this.selectedCreditStatus) {
        filters['status'] = { value: this.selectedCreditStatus, matchMode: 'equals' };
      }

      if (this.selectedCreditMethod) {
        filters['creditMethod'] = { value: this.selectedCreditMethod, matchMode: 'equals' };
      }

      if (this.selectedSupplier) {
        filters['purchaseReturn.purchase.supplier.name'] = { value: this.selectedSupplier.name, matchMode: 'equals' };
      }

      if (this.startDate || this.endDate) {
        if (this.startDate && this.endDate) {
          filters['creditDate'] = { value: [this.startDate, this.endDate], matchMode: 'dateBetween' };
        } else if (this.startDate) {
          filters['creditDate'] = { value: this.startDate, matchMode: 'dateIs' };
        } else if (this.endDate) {
          filters['creditDate'] = { value: this.endDate, matchMode: 'dateIs' };
        }
      }

      this.dt.filters = filters;
      this.dt.filteredValue = null;
    }
  }

  clearFilters() {
    this.selectedCreditStatus = null;
    this.selectedCreditMethod = null;
    this.selectedSupplier = null;
    this.startDate = null;
    this.endDate = null;
    this.globalFilter = '';
    this.onFilterChange();
    if (this.dt) {
      this.dt.filterGlobal('', 'contains');
    }
  }

  clear(table: Table) {
    table.clear();
  }

  async onGetAllCredits() {
    await this.purchaseCreditService.getCredits().subscribe({
      next: (response: any) => {
        this.credits = response;
        this.credits.forEach((credit: any) => {
          // Normalize purchaseCreditId to creditId for consistency
          if (credit.purchaseCreditId && !credit.creditId) {
            credit.creditId = credit.purchaseCreditId;
          }
          credit.creationDate = new Date(<Date>credit.creationDate);
          credit.creditDate = new Date(<Date>credit.creditDate);
          if (credit.checkExpirationDate) {
            credit.checkExpirationDate = new Date(<Date>credit.checkExpirationDate);
          }
          if (credit.boeExpirationDate) {
            credit.boeExpirationDate = new Date(<Date>credit.boeExpirationDate);
          }
        });
        this.loadUniqueSuppliers();
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_credits'),
          life: 3000
        });
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  async onDeleteCredit(id: any) {
    await this.purchaseCreditService.deleteCredit(id).subscribe({
      next: (response: any) => {
        this.onGetAllCredits();
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
        this.onGetAllCredits();
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
          this.onGetAllCredits();
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

  exportPdf() {
    this.reportingService.exportPdf(this.exportColumns, this.credits, 'purchase-credits');
  }

  exportExcel() {
    const modifiedCredits = this.credits.map(credit => {
      const modifiedCredit = { ...credit };
      delete modifiedCredit.creationDate;
      return modifiedCredit;
    });
    this.reportingService.exportExcel(modifiedCredits, 'purchase-credits');
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
      'Check': 'credit_method_check',
      'Card': 'credit_method_card',
      'Transfer': 'credit_method_transfer',
      'Cash': 'credit_method_cash',
      'BOE': 'credit_method_boe',
    }[method] || method;
  }

  getTotalAmount(): number {
    return this.credits?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
  }

  getPaymentMethodIcon(method: string): string {
    switch (method) {
      case 'CASH': return 'pi pi-money-bill';
      case 'CARD': return 'pi pi-credit-card';
      case 'TRANSFER': return 'pi pi-bank';
      case 'CHECK': return 'pi pi-file';
      default: return 'pi pi-wallet';
    }
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
        this.onGetAllCredits();
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

