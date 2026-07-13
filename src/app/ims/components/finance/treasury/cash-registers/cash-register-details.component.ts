import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ShopService } from 'src/app/services/shop.service';
import { CashRegisterService } from 'src/app/services/cash-register.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { ReportingService } from 'src/app/utils/reporting.service';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import { BankAccount } from 'src/app/models/bank-account';
import { Shop } from 'src/app/models/shop';
import { CashRegisterSession } from 'src/app/models/cashRegisterSession';
import { CashMovement } from 'src/app/models/cashMovement';
import { CashCollection } from 'src/app/models/cashCollection';
import { firstValueFrom } from 'rxjs';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

@Component({
  templateUrl: './cash-register-details.component.html',
  styleUrls: ['./cash-register-details.component.css', '../../finance.component.css'],
  providers: [MessageService]
})
export class CashRegisterDetailsComponent implements OnInit {
  TablePageSizeKeys = TablePageSizeKeys;

  shopId!: number;
  shop: Shop | null = null;
  cashRegisterData: any;
  currency = '';
  today = new Date();

  loadingCashRegister = false;
  loadingMovements = false;
  cashRegisterStats: Record<string, number> = {};

  sessions: CashRegisterSession[] = [];
  filteredSessions: CashRegisterSession[] = [];
  movements: CashMovement[] = [];
  filteredMovements: CashMovement[] = [];
  collections: CashCollection[] = [];
  filteredCollections: CashCollection[] = [];

  startDate: Date | null = null;
  endDate: Date | null = null;
  movementSearchTerm = '';
  collectionSearchTerm = '';
  selectedMovementTypeFilter: string | null = null;
  movementTypeOptions: { label: string; value: string }[] = [];

  movementsDialogVisible = false;
  selectedSessionMovements: CashMovement[] = [];

  showCashRegisterSessionDialog = false;

  newCollectionDialogVisible = false;
  newCollection = {
    amount: null as number | null,
    notes: '',
    destination: 'OWNER' as 'BANK' | 'OWNER' | 'SUPPLIER' | 'OTHER',
    bankAccountId: null as number | null,
  };
  collectionSubmitted = false;
  newDepositDialogVisible = false;
  newDeposit = { amount: null as number | null, notes: '' };
  depositSubmitted = false;
  newWithdrawDialogVisible = false;
  newWithdraw = { amount: null as number | null, notes: '' };
  withdrawSubmitted = false;

  dailyDifferenceTrend = 0;
  dailyDifferencePercentage = 0;

  isAdmin = false;
  canReadCash = false;

  // Cash ↔ bank transfer (PRO feature)
  canTransferCashBank = false;
  bankAccounts: BankAccount[] = [];
  transferDialogVisible = false;
  transferSaving = false;
  transferDirection: 'REGISTER_TO_BANK' | 'BANK_TO_REGISTER' = 'REGISTER_TO_BANK';
  transferBankAccountId: number | null = null;
  transferAmount: number | null = null;
  transferNotes = '';
  transferSubmitted = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private shopService: ShopService,
    private cashRegisterService: CashRegisterService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private reportingService: ReportingService,
    private bankAccountService: BankAccountService,
    private licenseCapabilities: LicenseCapabilitiesService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    public pageSizeService: TablePageSizeService
  ) {}

  async ngOnInit(): Promise<void> {
    this.today = new Date();
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });
    await this.setUserRoles();
    await this.checkPermissions();

    await this.licenseCapabilities.ensureLoaded();
    this.canTransferCashBank = this.isAdmin && this.licenseCapabilities.isFeatureEnabled('CASH_BANK_TRANSFERS');
    if (this.canTransferCashBank) {
      await this.loadBankAccounts();
    }

    this.route.paramMap.subscribe(async params => {
      const id = Number(params.get('shopId'));
      if (!id || Number.isNaN(id)) {
        void this.router.navigate(['/finance/treasury/cash-registers']);
        return;
      }
      this.shopId = id;
      await this.loadPage();
    });
  }

  private async setUserRoles(): Promise<void> {
    const roles = await this.keycloakService.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
  }

  private async checkPermissions(): Promise<void> {
    const profile = await this.keycloakService.loadUserProfile();
    await this.permissionService.init(profile.id!).toPromise();
    this.canReadCash = this.permissionService.canCashRead('SHOPS');
    if (!this.canReadCash) {
      void this.router.navigate(['/finance/treasury/cash-registers']);
    }
  }

  async loadPage(): Promise<void> {
    this.loadingCashRegister = true;
    try {
      this.shop = await firstValueFrom(this.shopService.getShop(this.shopId));
      if (!this.shop) {
        void this.router.navigate(['/finance/treasury/cash-registers']);
        return;
      }
      await this.refreshData(false);
    } catch (error) {
      console.error('Error loading cash register page:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_cash_register_data'),
        life: 4000,
      });
    } finally {
      this.loadingCashRegister = false;
      this.ngZone.run(() => this.cdr.detectChanges());
    }
  }

  goBack(): void {
    void this.router.navigate(['/finance/treasury/cash-registers']);
  }

  navigateToShopSettings(): void {
    if (!this.shopId) {
      return;
    }
    void this.router.navigate(['/inventory/shops', this.shopId]);
  }

  async loadCashRegisterData(): Promise<void> {
    if (!this.shopId) return;
    try {
      this.cashRegisterData = await firstValueFrom(this.shopService.getCashRegister(this.shopId));
    } catch {
      this.cashRegisterData = null;
    }
  }

  async loadSessions(): Promise<void> {
    const sessions$ = this.cashRegisterService.getSessionsByShop(this.shopId);
    this.sessions = await firstValueFrom(sessions$);
    this.filteredSessions = [...this.sessions];
  }

  async loadMovements(): Promise<void> {
    try {
      const movements$ = this.cashRegisterService.getMovementsByShop(this.shopId);
      this.movements = await firstValueFrom(movements$);
      this.filteredMovements = [...this.movements];
      const types = new Set<string>();
      this.movements.forEach(m => {
        if (m.type) types.add(m.type);
      });
      this.movementTypeOptions = Array.from(types).map(type => ({
        label: this.translate.instant('movement_' + type.toLowerCase()),
        value: type,
      }));
    } finally {
      this.loadingMovements = false;
    }
  }

  async loadCollections(): Promise<void> {
    const collections$ = this.cashRegisterService.getCollectionsByShop(this.shopId);
    this.collections = await firstValueFrom(collections$);
    this.filteredCollections = [...this.collections];
  }

  calculateCashRegisterStats(): void {
    const openSessions = this.sessions.filter(s => !s.closed);
    const closedSessions = this.sessions.filter(s => s.closed);
    const todaySessions = this.sessions.filter(s => {
      const sessionDate = new Date(s.openedAt || '');
      const today = new Date();
      return sessionDate.toDateString() === today.toDateString();
    });

    const deposits = this.movements.filter(m => m.type === 'DEPOSIT');
    const withdrawals = this.movements.filter(m => m.type === 'WITHDRAWAL');
    const adjustments = this.movements.filter(m => m.type === 'ADJUSTMENT');
    const expenses = this.movements.filter(m => m.type === 'EXPENSE');

    const totalDeposits = deposits.reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalWithdrawals = withdrawals.reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalAdjustments = adjustments.reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalCollections = this.collections.reduce((sum, c) => sum + (c.amountCollected || 0), 0);

    const avgSessionDuration = closedSessions.length > 0
      ? closedSessions.reduce((sum, s) => {
        if (s.openedAt && s.closedAt) {
          const opened = new Date(s.openedAt);
          const closed = new Date(s.closedAt);
          return sum + (closed.getTime() - opened.getTime());
        }
        return sum;
      }, 0) / closedSessions.length / (1000 * 60 * 60)
      : 0;

    this.cashRegisterStats = {
      totalSessions: this.sessions.length,
      openSessions: openSessions.length,
      closedSessions: closedSessions.length,
      todaySessions: todaySessions.length,
      avgSessionDuration,
      totalDeposits,
      totalWithdrawals,
      totalCollections,
      depositsCount: deposits.length,
      withdrawalsCount: withdrawals.length,
      cashFlow: (totalDeposits + totalCollections) - (totalWithdrawals + totalExpenses),
    };
  }

  async refreshData(manageLoadingState = false): Promise<void> {
    if (!this.shopId) return;
    if (manageLoadingState) {
      this.loadingCashRegister = true;
    }
    try {
      await Promise.allSettled([
        this.loadSessions(),
        this.loadCollections(),
        this.loadMovements(),
        this.loadCashRegisterData(),
      ]);
      this.calculateCashRegisterStats();
      this.filterByDateRange();
    } catch (error) {
      console.error('Error refreshing cash register data:', error);
      this.cashRegisterStats = {};
    } finally {
      if (manageLoadingState) {
        this.loadingCashRegister = false;
      }
    }
  }

  filterByDateRange(): void {
    if (this.startDate && this.endDate) {
      this.filteredSessions = this.sessions.filter(s =>
        new Date(s.openedAt!) >= this.startDate! && new Date(s.openedAt!) <= this.endDate!
      );
    } else {
      this.filteredSessions = [...this.sessions];
    }
  }

  clearDateFilter(): void {
    this.startDate = null;
    this.endDate = null;
    this.filteredSessions = [...this.sessions];
  }

  filterMovements(): void {
    let filtered = [...this.movements];
    if (this.movementSearchTerm) {
      const searchLower = this.movementSearchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.reference?.toLowerCase().includes(searchLower) ||
        m.performedByName?.toLowerCase().includes(searchLower) ||
        m.type?.toLowerCase().includes(searchLower)
      );
    }
    if (this.selectedMovementTypeFilter) {
      filtered = filtered.filter(m => m.type === this.selectedMovementTypeFilter);
    }
    this.filteredMovements = filtered;
  }

  filterCollections(): void {
    let filtered = [...this.collections];
    if (this.collectionSearchTerm) {
      const searchLower = this.collectionSearchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.receiptNumber?.toLowerCase().includes(searchLower) ||
        c.collectedByName?.toLowerCase().includes(searchLower) ||
        c.notes?.toLowerCase().includes(searchLower)
      );
    }
    this.filteredCollections = filtered;
  }

  clearMovementFilters(): void {
    this.movementSearchTerm = '';
    this.selectedMovementTypeFilter = null;
    this.filteredMovements = [...this.movements];
  }

  clearCollectionFilters(): void {
    this.collectionSearchTerm = '';
    this.filteredCollections = [...this.collections];
  }

  async onMovementsTabOpen(): Promise<void> {
    if (this.movements.length > 0) {
      return;
    }
    await this.loadMovements();
  }

  openCashRegisterSessionDialog(): void {
    this.showCashRegisterSessionDialog = true;
  }

  onSessionOpened(_session: CashRegisterSession): void {
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('success'),
      detail: this.translate.instant('cash_register_opened'),
      life: 3000,
    });
    void this.refreshData(true);
  }

  onSessionClosed(_session: CashRegisterSession): void {
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: this.translate.instant('cash_register_closed'),
      life: 3000,
    });
    void this.refreshData(true);
  }

  onCashRegisterSessionDialogClosed(): void {
    this.showCashRegisterSessionDialog = false;
  }

  async viewSessionMovements(session: CashRegisterSession): Promise<void> {
    try {
      const movements$ = this.cashRegisterService.getMovementsBySession(session.sessionId!);
      this.selectedSessionMovements = await firstValueFrom(movements$);
      this.movementsDialogVisible = true;
    } catch (error) {
      console.error('Error loading session movements:', error);
    }
  }

  async downloadZReport(session: CashRegisterSession): Promise<void> {
    if (!session?.sessionId) return;
    try {
      const response$ = await this.cashRegisterService.downloadZReportPdf(session.sessionId);
      const response: any = await firstValueFrom(response$);
      const blob: Blob = response?.body;
      if (!blob) throw new Error('Empty Z report response');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `z_report_session_${session.sessionId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading Z report:', error);
    }
  }

  exportCashRegisterData(): void {
    const exportData = {
      sessions: this.filteredSessions.map(s => ({
        cashier: s.username || 'N/A',
        openedAt: s.openedAt ? new Date(s.openedAt).toLocaleString() : 'N/A',
        closedAt: s.closedAt ? new Date(s.closedAt).toLocaleString() : 'Still Open',
        openingAmount: s.openingAmount || 0,
        closingAmount: s.closingAmount || 0,
        declaredDifference: s.declaredDifference || 0,
        status: s.closed ? 'Closed' : 'Open',
      })),
      movements: this.filteredMovements.map(m => ({
        type: m.type || 'N/A',
        amount: m.amount || 0,
        reference: m.reference || 'N/A',
        performedBy: m.performedByName || 'N/A',
        timestamp: m.timestamp ? new Date(m.timestamp).toLocaleString() : 'N/A',
      })),
      collections: this.filteredCollections.map(c => ({
        receiptNumber: c.receiptNumber || 'N/A',
        collectedAt: c.collectedAt ? new Date(c.collectedAt).toLocaleString() : 'N/A',
        amountCollected: c.amountCollected || 0,
        collectedBy: c.collectedByName || 'N/A',
        notes: c.notes || 'N/A',
      })),
    };

    this.reportingService.exportExcel(
      exportData.sessions.concat(exportData.movements as any).concat(exportData.collections as any),
      `cash_register_${this.shop?.shopName}_${new Date().toISOString().slice(0, 10)}`
    );
  }

  /** Collection destinations; the BANK option is only offered on PRO. */
  get collectionDestinationOptions(): { label: string; value: string }[] {
    const options = [
      { label: this.translate.instant('collection_destination_owner'), value: 'OWNER' },
      { label: this.translate.instant('collection_destination_supplier'), value: 'SUPPLIER' },
      { label: this.translate.instant('collection_destination_other'), value: 'OTHER' },
    ];
    if (this.canTransferCashBank) {
      options.unshift({ label: this.translate.instant('collection_destination_bank'), value: 'BANK' });
    }
    return options;
  }

  openNewCollectionDialog(): void {
    if (this.canTransferCashBank && !this.bankAccounts.length) {
      void this.loadBankAccounts();
    }
    this.collectionSubmitted = false;
    this.newCollection = {
      amount: null,
      notes: '',
      destination: this.canTransferCashBank ? 'BANK' : 'OWNER',
      bankAccountId: (this.shop as any)?.defaultBankAccountId ?? null,
    };
    this.newCollectionDialogVisible = true;
  }

  async saveNewCollection(): Promise<void> {
    this.collectionSubmitted = true;
    if (!this.newCollection.amount || this.newCollection.amount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('amount_must_be_greater_than_zero'),
        life: 3000,
      });
      return;
    }
    if (this.newCollection.destination === 'BANK' && !this.newCollection.bankAccountId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('select_bank_account'),
        life: 3000,
      });
      return;
    }
    try {
      const response = await firstValueFrom(
        await this.cashRegisterService.addCollection(
          this.shopId,
          this.newCollection.amount,
          this.newCollection.notes,
          this.newCollection.destination,
          this.newCollection.destination === 'BANK' ? this.newCollection.bankAccountId : null,
        )
      );
      if (response) {
        this.collections.unshift(response);
      }
      this.newCollectionDialogVisible = false;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('collection_added'),
        life: 3000,
      });
      await this.refreshData(true);
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || this.translate.instant('error');
      this.messageService.add({
        severity: 'error', summary: this.translate.instant('error'), detail: msg, life: 4000,
      });
    }
  }

  openNewDepositDialog(): void {
    this.depositSubmitted = false;
    this.newDepositDialogVisible = true;
    this.newDeposit = { amount: null, notes: '' };
  }

  async saveNewDeposit(): Promise<void> {
    this.depositSubmitted = true;
    if (!this.newDeposit.amount || this.newDeposit.amount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('amount_must_be_greater_than_zero'),
      });
      return;
    }
    (await this.cashRegisterService.depositMoney(this.cashRegisterData.cashRegisterId!, this.newDeposit)).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('deposit_added'),
        });
        this.newDepositDialogVisible = false;
        void this.refreshData(true);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_adding_deposit'),
        });
      },
    });
  }

  openNewWithdrawDialog(): void {
    this.withdrawSubmitted = false;
    this.newWithdrawDialogVisible = true;
    this.newWithdraw = { amount: null, notes: '' };
  }

  async saveNewWithdraw(): Promise<void> {
    this.withdrawSubmitted = true;
    if (!this.newWithdraw.amount || this.newWithdraw.amount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('amount_must_be_greater_than_zero'),
      });
      return;
    }
    try {
      (await this.cashRegisterService.withdrawMoney(this.cashRegisterData.cashRegisterId!, this.newWithdraw)).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('withdraw_added'),
          });
          this.newWithdrawDialogVisible = false;
          void this.refreshData(true);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_adding_withdrawal'),
          });
        },
      });
    } catch (error) {
      console.error('Error performing withdrawal:', error);
    }
  }

  // ========== Cash ↔ Bank transfer (PRO) ==========

  get transferDirectionOptions(): { label: string; value: string }[] {
    return [
      { label: this.translate.instant('cash_to_bank'), value: 'REGISTER_TO_BANK' },
      { label: this.translate.instant('bank_to_cash'), value: 'BANK_TO_REGISTER' },
    ];
  }

  get selectedTransferBankAccount(): BankAccount | undefined {
    return this.bankAccounts.find(a => a.accountId === this.transferBankAccountId);
  }

  private async loadBankAccounts(): Promise<void> {
    try {
      const obs = await this.bankAccountService.getBankAccounts(true);
      this.bankAccounts = (await firstValueFrom(obs)) || [];
    } catch (error) {
      console.error('Error loading bank accounts:', error);
      this.bankAccounts = [];
    }
  }

  openTransferDialog(): void {
    if (!this.bankAccounts.length) {
      void this.loadBankAccounts();
    }
    this.transferSubmitted = false;
    this.transferDirection = 'REGISTER_TO_BANK';
    this.transferAmount = null;
    this.transferNotes = '';
    const defaultId = (this.shop as any)?.defaultBankAccountId;
    this.transferBankAccountId = defaultId
      ?? (this.bankAccounts.length ? (this.bankAccounts[0].accountId ?? null) : null);
    this.transferDialogVisible = true;
  }

  async saveTransfer(): Promise<void> {
    this.transferSubmitted = true;
    if (!this.transferBankAccountId) {
      this.messageService.add({
        severity: 'warn', summary: this.translate.instant('warning'),
        detail: this.translate.instant('select_bank_account'), life: 3000,
      });
      return;
    }
    if (!this.transferAmount || this.transferAmount <= 0) {
      this.messageService.add({
        severity: 'warn', summary: this.translate.instant('warning'),
        detail: this.translate.instant('amount_must_be_greater_than_zero'), life: 3000,
      });
      return;
    }
    this.transferSaving = true;
    try {
      const obs = await this.cashRegisterService.transferCashBank(this.shopId, {
        direction: this.transferDirection,
        bankAccountId: this.transferBankAccountId,
        amount: this.transferAmount,
        notes: this.transferNotes,
      });
      await firstValueFrom(obs);
      this.transferDialogVisible = false;
      this.messageService.add({
        severity: 'success', summary: this.translate.instant('success'),
        detail: this.translate.instant('cash_bank_transfer_success'), life: 3000,
      });
      await this.refreshData(true);
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || this.translate.instant('error');
      this.messageService.add({
        severity: 'error', summary: this.translate.instant('error'), detail: msg, life: 4000,
      });
    } finally {
      this.transferSaving = false;
    }
  }
}
