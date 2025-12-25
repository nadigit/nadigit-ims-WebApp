import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Shop } from 'src/app/models/shop';
import { ShopService } from 'src/app/services/shop.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Purchase } from 'src/app/models/purchase';
import { Expense } from 'src/app/models/expense';
import { LocationService } from 'src/app/services/location.service';
import { DatePipe } from '@angular/common';
import { CashRegisterService } from 'src/app/services/cash-register.service';
import { CashRegisterSession } from 'src/app/models/cashRegisterSession';
import { CashMovement } from 'src/app/models/cashMovement';
import { CashCollection } from 'src/app/models/cashCollection';
import { CashRegister } from 'src/app/models/cashRegister';
import { ReportingService } from 'src/app/utils/reporting.service';

@Component({
  templateUrl: './shop-details.component.html',
  styleUrls: ['./shop-details.component.css', '../../inventory.component.css'],
  providers: [MessageService, DatePipe]
})
export class ShopDetailsComponent implements OnInit {

  shopId!: number;
  shop: Shop | null = null;

  isLoading: boolean = true;
  loadingShopDetails: boolean = false;
  loadingPurchases: boolean = false;
  loadingExpenses: boolean = false;
  currency: string = 'USD';

  cashRegisterData: any;
  organizationData: any;
  purchaseStats: any;
  expenseStats: any;
  recentPurchases: Purchase[] = [];
  recentExpenses: Expense[] = [];
  shopStats: any = {};

  canEditShop: boolean = false;
  canReadCash: boolean = false;
  Ressource: string = 'SHOPS';
  isAdmin: boolean = false;
  userRoles: any;

  shopDialog: boolean = false;
  submitted: boolean = false;
  selectedCountry: any = null;
  states: any = null;
  countries: any;

  // Cash Register properties
  cashRegisterDialog: boolean = false;
  cashRegister: CashRegister = {};
  cashRegisterSettingsDialog: boolean = false;
  loadingCashRegister: boolean = false;
  loadingMovements: boolean = false;
  sessions: CashRegisterSession[] = [];
  movements: CashMovement[] = [];
  collections: CashCollection[] = [];
  filteredSessions: CashRegisterSession[] = [];
  filteredMovements: CashMovement[] = [];
  filteredCollections: CashCollection[] = [];
  cashRegisterStats: any = {};
  movementTypeOptions: string[] = [];
  movementSearchTerm: string = '';
  collectionSearchTerm: string = '';
  selectedMovementTypeFilter: string | null = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  today: Date = new Date();
  movementsDialogVisible = false;
  selectedSessionMovements: CashMovement[] = [];
  newCollectionDialogVisible = false;
  newCollection = { amount: null, notes: '' };
  newDepositDialogVisible = false;
  newDeposit = { amount: null, notes: '' };
  newWithdrawDialogVisible = false;
  newWithdraw = { amount: null, notes: '' };
  showCashRegisterSessionDialog = false;
  dailyDifferenceTrend: number = 0;
  dailyDifferencePercentage: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private shopService: ShopService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private locationService: LocationService,
    private datePipe: DatePipe,
    private cashRegisterService: CashRegisterService,
    private reportingService: ReportingService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  async ngOnInit() {
    try {
      this.configService.currency$.subscribe(currency => {
        if (currency) {
          this.currency = currency;
        }
      });
      this.translateService.currentLanguage$.subscribe(lang => {
        this.translate.use(lang);
        this.countries = this.locationService.getAllCountriesWithTranslation();
      });

      this.route.params.subscribe(async params => {
        const id = params['id'];
        if (!id || isNaN(+id)) {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('invalid_shop_id'),
            life: 3000
          });
          this.router.navigate(['/inventory/shops']);
          return;
        }

        this.shopId = +id;
        await this.checkPermissions();
        await this.loadShop();
        await this.loadShopDetails();
        this.calculateShopStats();
        this.isLoading = false;
      });
    } catch (error) {
      console.error('Error initializing shop details:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_shop_details'),
        life: 3000
      });
      this.router.navigate(['/inventory/shops']);
    } finally {
      this.isLoading = false;
    }
  }

  async checkPermissions() {
    try {
      const profile = await this.keycloakService.loadUserProfile();
      const userId = profile.id;
      await firstValueFrom(this.permissionService.init(userId));
      this.canEditShop = this.permissionService.canUpdate(this.Ressource);
      this.canReadCash = this.permissionService.canCashRead(this.Ressource);
      
      // Get user roles
      this.userRoles = await this.keycloakService.getUserRoles();
      this.isAdmin = this.userRoles.includes('ADMIN');
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }

  async loadShop() {
    try {
      const shops = await firstValueFrom(this.shopService.getShops()) as Shop[];
      this.shop = shops.find((s: Shop) => s.shopId === this.shopId) || null;
      if (!this.shop) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('shop_not_found'),
          life: 3000
        });
        this.router.navigate(['/inventory/shops']);
        throw new Error('Shop not found');
      }
      if (this.shop.creationDate) {
        this.shop.creationDate = new Date(this.shop.creationDate);
      }
    } catch (error) {
      console.error('Error loading shop:', error);
      throw error;
    }
  }

  async loadShopDetails(): Promise<void> {
    if (!this.shop?.shopId) return;
    
    this.loadingShopDetails = true;
    try {
      await Promise.all([
        this.loadCashRegisterData(),
        this.loadOrganizationData(),
        this.loadPurchaseStats(),
        this.loadExpenseStats(),
        this.loadRecentPurchases(),
        this.loadRecentExpenses()
      ]);
    } catch (error) {
      console.error('Error loading shop details:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_shop_details'),
        life: 3000
      });
    } finally {
      this.loadingShopDetails = false;
    }
  }

  async loadCashRegisterData(): Promise<void> {
    if (!this.shop?.shopId) return;
    try {
      this.cashRegisterData = await firstValueFrom(this.shopService.getCashRegister(this.shop.shopId));
    } catch (error) {
      console.error('Error loading cash register:', error);
      this.cashRegisterData = null;
    }
  }

  async loadOrganizationData(): Promise<void> {
    if (!this.shop?.shopId) return;
    try {
      this.organizationData = await firstValueFrom(this.shopService.fetchOrganizationData(this.shop.shopId));
    } catch (error) {
      console.error('Error loading organization:', error);
      this.organizationData = null;
    }
  }

  async loadPurchaseStats(): Promise<void> {
    if (!this.shop?.shopId) return;
    try {
      this.purchaseStats = await firstValueFrom(this.shopService.fetchPurchaseStats(this.shop.shopId));
    } catch (error) {
      console.error('Error loading purchase stats:', error);
      this.purchaseStats = { count: 0, total: 0 };
    }
  }

  async loadExpenseStats(): Promise<void> {
    if (!this.shop?.shopId) return;
    try {
      this.expenseStats = await firstValueFrom(this.shopService.fetchExpenseStats(this.shop.shopId));
    } catch (error) {
      console.error('Error loading expense stats:', error);
      this.expenseStats = { count: 0, total: 0 };
    }
  }

  async loadRecentPurchases(): Promise<void> {
    if (!this.shop?.shopId) return;
    this.loadingPurchases = true;
    try {
      this.recentPurchases = await firstValueFrom(this.shopService.fetchRecentPurchases(this.shop.shopId)) as Purchase[];
    } catch (error) {
      console.error('Error loading recent purchases:', error);
      this.recentPurchases = [];
    } finally {
      this.loadingPurchases = false;
    }
  }

  async loadRecentExpenses(): Promise<void> {
    if (!this.shop?.shopId) return;
    this.loadingExpenses = true;
    try {
      this.recentExpenses = await firstValueFrom(this.shopService.fetchRecentExpenses(this.shop.shopId)) as Expense[];
    } catch (error) {
      console.error('Error loading recent expenses:', error);
      this.recentExpenses = [];
    } finally {
      this.loadingExpenses = false;
    }
  }

  calculateShopStats(): void {
    const totalPurchases = this.purchaseStats?.total || 0;
    const totalExpenses = this.expenseStats?.total || 0;
    const cashBalance = this.cashRegisterData?.totalBalance || 0;
    const purchaseCount = this.purchaseStats?.count || 0;
    const expenseCount = this.expenseStats?.count || 0;
    const recentPurchasesTotal = this.recentPurchases?.reduce((sum, p) => sum + (p.totalAmount || 0), 0) || 0;
    const recentExpensesTotal = this.recentExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

    this.shopStats = {
      cashBalance: cashBalance,
      totalPurchases: totalPurchases,
      totalExpenses: totalExpenses,
      purchaseCount: purchaseCount,
      expenseCount: expenseCount,
      netCashFlow: cashBalance - totalExpenses,
      recentPurchasesTotal: recentPurchasesTotal,
      recentExpensesTotal: recentExpensesTotal,
      averagePurchaseAmount: purchaseCount > 0 ? totalPurchases / purchaseCount : 0,
      averageExpenseAmount: expenseCount > 0 ? totalExpenses / expenseCount : 0
    };
  }

  getPaymentMethodSeverity(method: string): string {
    switch (method?.toLowerCase()) {
      case 'cash':
        return 'success';
      case 'credit':
        return 'warning';
      case 'check':
        return 'help';
      case 'transfer':
        return 'info';
      default:
        return 'danger';
    }
  }

  refreshData(): void {
    if (this.shop?.shopId) {
      this.loadingShopDetails = true;
      this.loadShopDetails().then(() => {
        this.calculateShopStats();
        this.loadingShopDetails = false;
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('data_refreshed'),
          life: 2000
        });
      }).catch(error => {
        console.error('Error refreshing shop details:', error);
        this.loadingShopDetails = false;
      });
    }
  }

  openCashRegisterDialog(): void {
    if (!this.shop?.shopId) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: 'Shop ID is missing',
        life: 3000
      });
      return;
    }

    // Reset all data and filters
    this.cashRegister = {};
    this.startDate = null;
    this.endDate = null;
    this.movementSearchTerm = '';
    this.collectionSearchTerm = '';
    this.selectedMovementTypeFilter = null;
    
    // Initialize empty arrays
    this.sessions = [];
    this.filteredSessions = [];
    this.movements = [];
    this.filteredMovements = [];
    this.collections = [];
    this.filteredCollections = [];
    
    // Initialize stats with default values
    this.cashRegisterStats = {
      totalSessions: 0,
      openSessions: 0,
      closedSessions: 0,
      todaySessions: 0,
      avgSessionDuration: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalCollections: 0,
      cashFlow: 0
    };

    // Set loading state
    this.loadingCashRegister = true;

    // Open dialog IMMEDIATELY
    this.cashRegisterDialog = true;
    
    // Force change detection
    this.cdr.detectChanges();

    // Load data asynchronously AFTER dialog is opened
    this.loadCashRegisterDialogData();
  }

  private async loadCashRegisterDialogData(): Promise<void> {
    if (!this.shop?.shopId) {
      this.loadingCashRegister = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      // Load data in parallel
      await Promise.allSettled([
        this.refreshCashRegisterData(false),
        this.onGetShopCashRegister()
      ]);
      
      console.log('✅ Cash register data loaded');
    } catch (error) {
      console.error('❌ Error loading cash register data:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_cash_register_data'),
        life: 3000
      });
    } finally {
      this.loadingCashRegister = false;
      this.ngZone.run(() => {
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    }
  }

  async onGetShopCashRegister(): Promise<void> {
    try {
      const response = await firstValueFrom(this.shopService.getCashRegister(this.shop!.shopId));
      this.cashRegister = response || {};
      
      // Convert time strings to Date objects if needed
      if (this.cashRegister.openingTime && typeof this.cashRegister.openingTime === 'string') {
        const [hours, minutes] = this.cashRegister.openingTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        this.cashRegister.openingTime = date;
      }
      if (this.cashRegister.closingTime && typeof this.cashRegister.closingTime === 'string') {
        const [hours, minutes] = this.cashRegister.closingTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        this.cashRegister.closingTime = date;
      }

      this.filterByDateRange();
    } catch (err) {
      console.error('Error loading cash register:', err);
      this.cashRegister = {};
      throw err;
    }
  }

  async refreshCashRegisterData(manageLoadingState: boolean = false): Promise<void> {
    if (!this.shop?.shopId) {
      return;
    }
    
    if (manageLoadingState) {
      this.loadingCashRegister = true;
    }
    
    try {
      const results = await Promise.allSettled([
        this.loadSessions(),
        this.loadCollections(),
        this.loadMovements()
      ]);
      
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn('⚠️ Some data loading failed:', failures);
      }
      
      this.calculateCashRegisterStats();
      
      if (manageLoadingState) {
        this.loadingCashRegister = false;
      }
    } catch (error) {
      console.error('❌ Error refreshing cash register data:', error);
      if (manageLoadingState) {
        this.loadingCashRegister = false;
      }
      this.cashRegisterStats = {};
    }
  }

  async loadSessions(): Promise<void> {
    try {
      const sessions$ = this.cashRegisterService.getSessionsByShop(this.shop!.shopId);
      this.sessions = await firstValueFrom(sessions$);
      this.filteredSessions = [...this.sessions];
    } catch (error) {
      console.error('❌ Failed to load sessions:', error);
      this.sessions = [];
      this.filteredSessions = [];
      throw error;
    }
  }

  async loadMovements(): Promise<void> {
    try {
      const movements$ = this.cashRegisterService.getMovementsByShop(this.shop!.shopId);
      this.movements = await firstValueFrom(movements$);
      this.filteredMovements = [...this.movements];

      const types = new Set<string>();
      this.movements.forEach(m => {
        if (m.type) types.add(m.type);
      });
      this.movementTypeOptions = Array.from(types);
    } catch (error) {
      console.error('❌ Failed to load movements:', error);
      this.movements = [];
      this.filteredMovements = [];
    } finally {
      this.loadingMovements = false;
    }
  }

  async loadCollections(): Promise<void> {
    try {
      const collections$ = this.cashRegisterService.getCollectionsByShop(this.shop!.shopId);
      this.collections = await firstValueFrom(collections$);
      this.filteredCollections = [...this.collections];
    } catch (error) {
      console.error('❌ Failed to load collections:', error);
      this.collections = [];
      this.filteredCollections = [];
      throw error;
    }
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
      avgSessionDuration: avgSessionDuration,
      totalMovements: this.movements.length,
      totalDeposits: totalDeposits,
      totalWithdrawals: totalWithdrawals,
      totalAdjustments: totalAdjustments,
      totalExpenses: totalExpenses,
      depositsCount: deposits.length,
      withdrawalsCount: withdrawals.length,
      adjustmentsCount: adjustments.length,
      expensesCount: expenses.length,
      netMovements: totalDeposits - totalWithdrawals - totalExpenses + totalAdjustments,
      totalCollections: totalCollections,
      collectionsCount: this.collections.length,
      cashFlow: (totalDeposits + totalCollections) - (totalWithdrawals + totalExpenses)
    };
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

  filterByDateRange(): void {
    if (this.startDate && this.endDate) {
      this.filteredSessions = this.sessions.filter(s =>
        new Date(s.openedAt) >= this.startDate! && new Date(s.openedAt) <= this.endDate!
      );
    } else {
      this.filteredSessions = [...this.sessions];
    }
  }

  clearDateFilter(): void {
    this.startDate = this.endDate = null;
    this.filteredSessions = [...this.sessions];
  }

  async viewSessionMovements(session: CashRegisterSession): Promise<void> {
    try {
      const movements$ = this.cashRegisterService.getMovementsBySession(session.sessionId);
      this.selectedSessionMovements = await firstValueFrom(movements$);
      this.movementsDialogVisible = true;
    } catch (error) {
      console.error('❌ Error loading session movements:', error);
    }
  }

  closeCashRegisterDialog(): void {
    this.cashRegisterDialog = false;
  }

  async onMovementsTabOpen(): Promise<void> {
    if (this.movements && this.movements.length > 0) {
      return;
    }
    await this.loadMovements();
  }

  openNewCollectionDialog(): void {
    this.newCollectionDialogVisible = true;
    this.newCollection = { amount: null, notes: '' };
  }

  async saveNewCollection(): Promise<void> {
    if (!this.newCollection.amount || this.newCollection.amount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid Amount',
        detail: 'Please enter a valid amount.',
        life: 3000
      });
      return;
    }

    try {
      const shopId = this.shop!.shopId;
      const { amount, notes } = this.newCollection;

      const collectionObservable = await this.cashRegisterService.addCollection(shopId, amount, notes);
      const response = await firstValueFrom(collectionObservable);

      if (response) {
        this.collections.unshift(response);
        this.filteredCollections = [...this.collections];
      }

      this.newCollectionDialogVisible = false;

      this.messageService.add({
        severity: 'success',
        summary: 'Collection Performed',
        detail: 'Cash collection has been successfully recorded.',
        life: 3000
      });

      if (this.cashRegisterDialog) {
        this.refreshCashRegisterData(true);
      }
    } catch (error) {
      console.error('❌ Error performing collection:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to perform cash collection.',
        life: 4000
      });
    }
  }

  openNewDepositDialog(): void {
    this.newDepositDialogVisible = true;
    this.newDeposit = { amount: null, notes: '' };
  }

  openNewWithdrawDialog(): void {
    this.newWithdrawDialogVisible = true;
    this.newWithdraw = { amount: null, notes: '' };
  }

  async saveNewWithdraw(): Promise<void> {
    if (!this.newWithdraw.amount || this.newWithdraw.amount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid Amount',
        detail: 'Please enter a valid amount.',
        life: 3000
      });
      return;
    }

    try {
      const withdrawObservable = await this.cashRegisterService.withdrawMoney(this.cashRegister.cashRegisterId, this.newWithdraw);
      await firstValueFrom(withdrawObservable);
      
      this.messageService.add({
        severity: 'success',
        summary: 'Withdraw Performed',
        detail: 'Cash withdrawal has been successfully recorded.',
        life: 3000
      });

      if (this.cashRegisterDialog) {
        this.refreshCashRegisterData(true);
      }
    } catch (error) {
      console.error('❌ Error performing withdrawal:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to perform cash withdrawal.',
        life: 4000
      });
    }
  }

  async saveNewDeposit(): Promise<void> {
    if (!this.newDeposit.amount || this.newDeposit.amount <= 0) {
      this.messageService.add({ 
        severity: 'warn', 
        summary: this.translate.instant('warning'), 
        detail: this.translate.instant('amount_must_be_greater_than_zero') 
      });
      return;
    }

    try {
      const depositObservable = await this.cashRegisterService.depositMoney(this.cashRegister.cashRegisterId, this.newDeposit);
      await firstValueFrom(depositObservable);
      
      this.messageService.add({ 
        severity: 'success', 
        summary: this.translate.instant('success'), 
        detail: this.translate.instant('deposit_added') 
      });
      this.newDepositDialogVisible = false;
      
      if (this.cashRegisterDialog) {
        this.refreshCashRegisterData(true);
      }
    } catch (err) {
      this.messageService.add({ 
        severity: 'error', 
        summary: this.translate.instant('error'), 
        detail: this.translate.instant('error_adding_deposit') 
      });
      console.error(err);
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
        status: s.closed ? 'Closed' : 'Open'
      })),
      movements: this.filteredMovements.map(m => ({
        type: m.type || 'N/A',
        amount: m.amount || 0,
        reference: m.reference || 'N/A',
        performedBy: m.performedByName || 'N/A',
        timestamp: m.timestamp ? new Date(m.timestamp).toLocaleString() : 'N/A'
      })),
      collections: this.filteredCollections.map(c => ({
        receiptNumber: c.receiptNumber || 'N/A',
        collectedAt: c.collectedAt ? new Date(c.collectedAt).toLocaleString() : 'N/A',
        amountCollected: c.amountCollected || 0,
        collectedBy: c.collectedByName || 'N/A',
        notes: c.notes || 'N/A'
      }))
    };

    this.reportingService.exportExcel(
      exportData.sessions.concat(exportData.movements as any).concat(exportData.collections as any),
      `cash_register_${this.shop!.shopName}_${new Date().toISOString().slice(0, 10)}`
    );
  }

  openCashRegisterSessionDialog(): void {
    this.showCashRegisterSessionDialog = true;
  }

  onSessionOpened(session: CashRegisterSession): void {
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('success'),
      detail: this.translate.instant('cash_register_opened'),
      life: 3000
    });
    if (this.cashRegisterDialog) {
      this.refreshCashRegisterData(true);
    }
  }

  onSessionClosed(session: CashRegisterSession): void {
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: this.translate.instant('cash_register_closed'),
      life: 3000
    });
    if (this.cashRegisterDialog) {
      this.refreshCashRegisterData(true);
    }
  }

  onCashRegisterSessionDialogClosed(): void {
    this.showCashRegisterSessionDialog = false;
  }

  openSettingsDialog(): void {
    this.cashRegisterSettingsDialog = true;
  }

  hideSettingsDialog(): void {
    this.cashRegisterSettingsDialog = false;
    this.cashRegister = {};
  }

  updateCashRegister(): void {
    this.submitted = true;

    if (this.cashRegister.openingTime && this.cashRegister.closingTime) {
      const formatDateToLocalTime = (date: Date): string => {
        return date.toTimeString().split(' ')[0];
      };

      this.cashRegister.openingTime = formatDateToLocalTime(new Date(this.cashRegister.openingTime));
      this.cashRegister.closingTime = formatDateToLocalTime(new Date(this.cashRegister.closingTime));

      const success = this.saveCashRegister(this.shop!.shopId, this.cashRegister);

      if (success) {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('cash_register_updated'),
          life: 3000
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_updating_cash_register'),
          life: 3000
        });
      }

      this.cashRegisterSettingsDialog = false;
      this.cashRegister = {};
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
    }
  }

  async saveCashRegister(id: any, cashRegister: any): Promise<any> {
    try {
      await firstValueFrom(this.shopService.updateCashRegister(id, cashRegister));
      this.onGetShopCashRegister();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  editShop(): void {
    if (!this.shop) return;
    this.selectedCountry = {};
    this.shopDialog = true;
    if (this.shop.country) {
      this.onSelectedCountry(this.shop.country);
    }
  }

  hideDialog(): void {
    this.shopDialog = false;
    this.submitted = false;
    this.selectedCountry = {};
  }

  onChangeCountry(): void {
    if (this.shop) {
      this.shop.city = undefined;
    }
  }

  onSelectedCountry(event: any): void {
    if (!this.shop) return;
    if ((this.shop.country !== this.selectedCountry) && (this.shop.city === undefined)) {
      this.shop.city = undefined;
    }
    this.countries.forEach((element: any) => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    this.states = this.locationService.getStatesByCountryCode(this.selectedCountry.isoCode);
  }

  filterCountry(value: any, filter: string): boolean {
    const normalizedFilter = filter.toLowerCase();
    return (
      value.name.toLowerCase().includes(normalizedFilter) ||
      value.translatedName.toLowerCase().includes(normalizedFilter)
    );
  }

  saveShop(): void {
    this.submitted = true;
    if (!this.shop?.shopName) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
      return;
    }

    if (this.shop.shopId) {
      this.updateShop(this.shop.shopId, this.shop);
    } else {
      this.addShop(this.shop);
    }
  }

  async updateShop(id: any, shop: any): Promise<void> {
    try {
      await firstValueFrom(this.shopService.updateShop(id, shop));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('shop_updated'),
        life: 3000
      });
      this.shopDialog = false;
      await this.loadShop();
      await this.loadShopDetails();
      this.calculateShopStats();
    } catch (error) {
      console.error('Error updating shop:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_updating_shop'),
        life: 3000
      });
    }
  }

  async addShop(data: any): Promise<void> {
    try {
      await firstValueFrom(this.shopService.saveShop(data));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('shop_added'),
        life: 3000
      });
      this.shopDialog = false;
      this.router.navigate(['/inventory/shops']);
    } catch (error) {
      console.error('Error adding shop:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_adding_shop'),
        life: 3000
      });
    }
  }

  printShopDetails(): void {
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/inventory/shops']);
  }
}

