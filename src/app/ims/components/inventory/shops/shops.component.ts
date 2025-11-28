import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Country, State } from 'country-state-city';
import { ShopService } from 'src/app/services/shop.service';
import { TranslationService } from 'src/app/services/translation.service';
import { TranslateService } from '@ngx-translate/core';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Shop } from 'src/app/models/shop';
import { CashRegister } from 'src/app/models/cashRegister';
import { DailyBalance } from 'src/app/models/dailyBalance';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import * as XLSX from 'xlsx';
import { DatePipe } from '@angular/common';
import { Purchase } from 'src/app/models/purchase';
import { Expense } from 'src/app/models/expense';
import { LocationService } from 'src/app/services/location.service';
import { CashRegisterSession } from 'src/app/models/cashRegisterSession';
import { CashMovement } from 'src/app/models/cashMovement';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { CashRegisterService } from 'src/app/services/cash-register.service';
import { CashCollection } from 'src/app/models/cashCollection';

@Component({
  templateUrl: './shops.component.html',
  styleUrls: ['./shops.component.css', '../inventory.component.css'],
  providers: [MessageService, DatePipe]
})
export class ShopsComponent implements OnInit {

  Ressource: string = 'SHOPS';

  shopDialog: boolean = false;

  deleteShopDialog: boolean = false;

  deleteShopsDialog: boolean = false;

  shops: Shop[] = [];

  shop: Shop = {};

  cashRegister: CashRegister = {};

  selectedShops: Shop[] = [];

  selectedShop: Shop = {};

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  countries: any;

  selectedCountry: any = null;

  states: any = null;

  today: Date;

  cashRegisterDialog: boolean = false;
  dailyBalances: DailyBalance[] = [];
  selectedDate: Date;
  filteredBalances: DailyBalance[] = [];  // Store the filtered balances
  totalDailyDifference: number = 0;
  startDate: Date | null = null; // Initialize start date
  endDate: Date | null = null;   // Initialize end date

  exportColumns!: ExportColumn[];

  canAddShop: boolean = false;
  canEditShop: boolean = false;
  canReadShop: boolean = false;
  canDeleteShop: boolean = false;
  canReadCash: boolean = false;

  isLoading: boolean = false;

  cashRegisterSettingsDialog: boolean = false;
  currency: any = '';

  shopDetailsDialog: boolean = false;
  loading: boolean = false;
  loadingShopDetails: boolean = false;
  loadingPurchases: boolean = false;
  loadingExpenses: boolean = false;
  cashRegisterData: any;
  organizationData: any;
  purchaseStats: any;
  expenseStats: any;
  recentPurchases: Purchase[] = [];
  recentExpenses: Expense[] = [];
  shopStats: any = {};

  dailyDifferenceTrend: number = 0;
  dailyDifferencePercentage: number = 0;

  sessions: CashRegisterSession[] = [];
  movements: CashMovement[] = [];
  collections: CashCollection[] = [];
  filteredSessions: CashRegisterSession[] = [];

  movementsDialogVisible = false;
  selectedSessionMovements: CashMovement[] = [];
  
  // Cash Register Statistics
  cashRegisterStats: any = {};
  loadingCashRegister: boolean = false;
  loadingMovements: boolean = false; // specific loading flag for movements tab
  filteredMovements: CashMovement[] = [];
  movementTypeOptions: string[] = []; // for movements filter dropdown
  filteredCollections: CashCollection[] = [];
  movementSearchTerm: string = '';
  collectionSearchTerm: string = '';
  selectedMovementTypeFilter: string | null = null;
  newCollectionDialogVisible = false;

  newCollection = {
    amount: null,
    notes: ''
  };

  userRoles: any;
  isAdmin: boolean = false;

  newDepositDialogVisible = false;
  newDeposit = { amount: null, notes: '' };

  showCashRegisterSessionDialog = false;


  constructor(private messageService: MessageService,
    private shopService: ShopService,
    private datePipe: DatePipe,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private locationService: LocationService,
    private permissionService: PermissionService,
    private configService: AppConfigurationService,
    private cashRegisterService: CashRegisterService,
    public keycloakService: KeycloakService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone) { }

  async ngOnInit() {
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    this.startDate = defaultStartDate;
    this.endDate = new Date();
    this.today = new Date();
    this.isLoading = true;
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.countries = this.locationService.getAllCountriesWithTranslation();

    });
    await this.setUserRoles();
    await this.checkPermissions();
    this.onGetAllShops();
    // this.onGetCurrecy();

    this.cols = [
      { field: 'shopId', header: this.translateService.instant('ID') },
      { field: 'shopName', header: this.translateService.instant('shop_name') },
      { field: 'description', header: this.translateService.instant('shop_description') },
      { field: 'city', header: this.translateService.instant('shop_city') },
      { field: 'country', header: this.translateService.instant('shop_country') },
      { field: 'address', header: this.translateService.instant('shop_address') },
    ];

    this.statuses = [
      { label: 'INSTOCK', value: 'instock' },
      { label: 'LOWSTOCK', value: 'lowstock' },
      { label: 'OUTOFSTOCK', value: 'outofstock' }
    ];



    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

  }

  getPurchaseStatusSeverity(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'danger';
      default:
        return 'info';
    }
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

  async loadShopDetails(): Promise<void> {
    this.loading = true;
    console.log('Loading shop details for:', this.shop);
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
      this.loading = false;
    }
  }

  async loadCashRegisterData(): Promise<void> {
    if (!this.selectedShop.shopId) return;
    try {
      this.cashRegisterData = await this.shopService.getCashRegister(this.selectedShop.shopId).toPromise();
    } catch (error) {
      console.error('Error loading cash register:', error);
      this.cashRegisterData = null;
    }
  }

  async loadSessions(): Promise<void> {
    try {
      console.log('📥 Loading sessions for shop:', this.shop.shopId);
      const sessions$ = this.cashRegisterService.getSessionsByShop(this.shop.shopId);
      this.sessions = await firstValueFrom(sessions$);
      this.filteredSessions = [...this.sessions];
      console.log('✅ Loaded sessions:', this.sessions.length);
    } catch (error) {
      console.error('❌ Failed to load sessions:', error);
      this.sessions = [];
      this.filteredSessions = [];
      throw error; // Re-throw to be caught by refreshData
    }
  }

  async loadMovements(): Promise<void> {
    try {
      console.log('📥 Loading movements for shop:', this.shop.shopId);
      const movements$ = this.cashRegisterService.getMovementsByShop(this.shop.shopId);
      this.movements = await firstValueFrom(movements$);
      this.filteredMovements = [...this.movements];

      // Build unique movement type options once, for the dropdown
      const types = new Set<string>();
      this.movements.forEach(m => {
        if (m.type) types.add(m.type);
      });
      this.movementTypeOptions = Array.from(types);

      console.log('✅ Loaded movements:', this.movements.length, 'types:', this.movementTypeOptions);
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
      console.log('📥 Loading collections for shop:', this.shop.shopId);
      const collections$ = this.cashRegisterService.getCollectionsByShop(this.shop.shopId);
      this.collections = await firstValueFrom(collections$);
      this.filteredCollections = [...this.collections];
      console.log('✅ Loaded collections:', this.collections.length);
    } catch (error) {
      console.error('❌ Failed to load collections:', error);
      this.collections = [];
      this.filteredCollections = [];
      throw error; // Re-throw to be caught by refreshData
    }
  }

  calculateCashRegisterStats(): void {
    // Session Statistics
    const openSessions = this.sessions.filter(s => !s.closed);
    const closedSessions = this.sessions.filter(s => s.closed);
    const todaySessions = this.sessions.filter(s => {
      const sessionDate = new Date(s.openedAt || '');
      const today = new Date();
      return sessionDate.toDateString() === today.toDateString();
    });

    // Movement Statistics
    const deposits = this.movements.filter(m => m.type === 'DEPOSIT');
    const withdrawals = this.movements.filter(m => m.type === 'WITHDRAWAL');
    const adjustments = this.movements.filter(m => m.type === 'ADJUSTMENT');
    const expenses = this.movements.filter(m => m.type === 'EXPENSE');
    
    const totalDeposits = deposits.reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalWithdrawals = withdrawals.reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalAdjustments = adjustments.reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, m) => sum + (m.amount || 0), 0);

    // Collection Statistics
    const totalCollections = this.collections.reduce((sum, c) => sum + (c.amountCollected || 0), 0);
    const todayCollections = this.collections.filter(c => {
      const collectionDate = new Date(c.collectedAt || '');
      const today = new Date();
      return collectionDate.toDateString() === today.toDateString();
    });
    const totalTodayCollections = todayCollections.reduce((sum, c) => sum + (c.amountCollected || 0), 0);

    // Session Performance
    const avgSessionDuration = closedSessions.length > 0
      ? closedSessions.reduce((sum, s) => {
          if (s.openedAt && s.closedAt) {
            const opened = new Date(s.openedAt);
            const closed = new Date(s.closedAt);
            return sum + (closed.getTime() - opened.getTime());
          }
          return sum;
        }, 0) / closedSessions.length / (1000 * 60 * 60) // Convert to hours
      : 0;

    const avgOpeningAmount = this.sessions.length > 0
      ? this.sessions.reduce((sum, s) => sum + (s.openingAmount || 0), 0) / this.sessions.length
      : 0;

    const avgClosingAmount = closedSessions.length > 0
      ? closedSessions.reduce((sum, s) => sum + (s.closingAmount || 0), 0) / closedSessions.length
      : 0;

    // Calculate differences
    const totalDifferences = closedSessions.reduce((sum, s) => sum + (s.declaredDifference || 0), 0);
    const avgDifference = closedSessions.length > 0 ? totalDifferences / closedSessions.length : 0;

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentMovements = this.movements.filter(m => {
      const movementDate = new Date(m.timestamp || '');
      return movementDate >= sevenDaysAgo;
    });
    const recentCollections = this.collections.filter(c => {
      const collectionDate = new Date(c.collectedAt || '');
      return collectionDate >= sevenDaysAgo;
    });

    this.cashRegisterStats = {
      // Sessions
      totalSessions: this.sessions.length,
      openSessions: openSessions.length,
      closedSessions: closedSessions.length,
      todaySessions: todaySessions.length,
      avgSessionDuration: avgSessionDuration,
      avgOpeningAmount: avgOpeningAmount,
      avgClosingAmount: avgClosingAmount,
      avgDifference: avgDifference,
      
      // Movements
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
      
      // Collections
      totalCollections: totalCollections,
      collectionsCount: this.collections.length,
      todayCollections: totalTodayCollections,
      todayCollectionsCount: todayCollections.length,
      avgCollectionAmount: this.collections.length > 0 ? totalCollections / this.collections.length : 0,
      
      // Recent Activity
      recentMovementsCount: recentMovements.length,
      recentCollectionsCount: recentCollections.length,
      
      // Performance Metrics
      cashFlow: (totalDeposits + totalCollections) - (totalWithdrawals + totalExpenses),
      efficiency: closedSessions.length > 0 ? ((closedSessions.filter(s => (s.declaredDifference || 0) === 0).length / closedSessions.length) * 100) : 0
    };
  }

  filterMovements(): void {
    let filtered = [...this.movements];

    // Filter by search term
    if (this.movementSearchTerm) {
      const searchLower = this.movementSearchTerm.toLowerCase();
      filtered = filtered.filter(m => 
        m.reference?.toLowerCase().includes(searchLower) ||
        m.performedByName?.toLowerCase().includes(searchLower) ||
        m.type?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by type
    if (this.selectedMovementTypeFilter) {
      filtered = filtered.filter(m => m.type === this.selectedMovementTypeFilter);
    }

    this.filteredMovements = filtered;
  }

  filterCollections(): void {
    let filtered = [...this.collections];

    // Filter by search term
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

  // getMovementTypes(): string[] {
  //   const types = new Set<string>();
  //   this.movements.forEach(m => {
  //     if (m.type) types.add(m.type);
  //   });
  //   return Array.from(types);
  // }

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
      `cash_register_${this.shop.shopName}_${new Date().toISOString().slice(0, 10)}`
    );
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

  async loadOrganizationData(): Promise<void> {
    if (!this.selectedShop.shopId) return;
    try {
      this.organizationData = await this.shopService.fetchOrganizationData(this.selectedShop.shopId).toPromise();
    } catch (error) {
      console.error('Error loading organization:', error);
      this.organizationData = null;
    }
  }

  async loadPurchaseStats(): Promise<void> {
    if (!this.selectedShop.shopId) return;
    try {
      this.purchaseStats = await this.shopService.fetchPurchaseStats(this.selectedShop.shopId).toPromise();
    } catch (error) {
      console.error('Error loading purchase stats:', error);
      this.purchaseStats = { count: 0, total: 0 };
    }
  }

  async loadExpenseStats(): Promise<void> {
    if (!this.selectedShop.shopId) return;
    try {
      this.expenseStats = await this.shopService.fetchExpenseStats(this.selectedShop.shopId).toPromise();
    } catch (error) {
      console.error('Error loading expense stats:', error);
      this.expenseStats = { count: 0, total: 0 };
    }
  }

  async loadRecentPurchases(): Promise<void> {
    if (!this.selectedShop.shopId) return;
    this.loadingPurchases = true;
    try {
      this.recentPurchases = await this.shopService.fetchRecentPurchases(this.selectedShop.shopId).toPromise() as Purchase[];
    } catch (error) {
      console.error('Error loading recent purchases:', error);
      this.recentPurchases = [];
    } finally {
      this.loadingPurchases = false;
    }
  }

  async loadRecentExpenses(): Promise<void> {
    if (!this.selectedShop.shopId) return;
    this.loadingExpenses = true;
    try {
      this.recentExpenses = await this.shopService.fetchRecentExpenses(this.selectedShop.shopId).toPromise() as Expense[];
    } catch (error) {
      console.error('Error loading recent expenses:', error);
      this.recentExpenses = [];
    } finally {
      this.loadingExpenses = false;
    }
  }

  // refreshData(): void {
  //   Promise.all([
  //     this.fetchCashRegisterData(this.shop.shopId),
  //     this.onGetShopCashRegister()
  //   ]);
  // }

  exportToExcel(): void {
    const dataToExport = this.filteredBalances.map(balance => ({
      'Date': this.datePipe.transform(balance.balanceDate, 'shortDate'),
      'Opening Balance': balance.openingBalance,
      'Closing Balance': balance.closingBalance,
      'Daily Difference': balance.dailyDifference
    }));

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
    XLSX.writeFile(workbook, `CashRegister_${this.shop.shopName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  printReport(): void {
    window.print();
  }


  isToday(date: Date): boolean {
    if (!date) return false;
    const balanceDate = new Date(date);
    const today = new Date();
    return (
      balanceDate.getDate() === today.getDate() &&
      balanceDate.getMonth() === today.getMonth() &&
      balanceDate.getFullYear() === today.getFullYear()
    );
  }


  calculateTotalsAndTrends(): void {
    // Calculate trend (compare with previous period)
    if (this.filteredBalances.length > 1) {
      const currentPeriodSum = this.filteredBalances.slice(-7).reduce(
        (sum, balance) => sum + (balance.dailyDifference || 0), 0
      );
      const previousPeriodSum = this.filteredBalances.slice(-14, -7).reduce(
        (sum, balance) => sum + (balance.dailyDifference || 0), 0
      );

      this.dailyDifferenceTrend = currentPeriodSum - previousPeriodSum;
      this.dailyDifferencePercentage = previousPeriodSum !== 0 ?
        (this.dailyDifferenceTrend / Math.abs(previousPeriodSum)) * 100 : 0;
    } else {
      this.dailyDifferenceTrend = 0;
      this.dailyDifferencePercentage = 0;
    }
  }

  // clearDateFilter(): void {
  //   this.startDate = null;
  //   this.endDate = null;
  //   this.filterByDateRange();
  // }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddShop = this.permissionService.canCreate(this.Ressource);
    this.canEditShop = this.permissionService.canUpdate(this.Ressource);
    this.canReadShop = this.permissionService.canRead(this.Ressource);
    this.canDeleteShop = this.permissionService.canDelete(this.Ressource);
    this.canReadCash = this.permissionService.canCashRead(this.Ressource);

  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  deleteSelectedShops() {
    this.deleteShopsDialog = true;
  }

  editShop(shop: Shop) {
    this.selectedCountry = {};
    this.shop = { ...shop };
    this.shopDialog = true;
    console.log(this.shop.country)
    if (this.shop.country) {
      this.onSelectedCountry(this.shop.country)
    }
  }

  async showShopDetailsDialog(shop: Shop): Promise<void> {
    console.log('Selected shop:', shop);

    this.selectedShop = {
      ...shop,
      creationDate: shop.creationDate ? new Date(shop.creationDate) : null
    };

    this.shopDetailsDialog = true;
    this.loadingShopDetails = true;

    try {
      await this.loadShopDetails();
      this.calculateShopStats();
      console.log('Shop details loaded:', this.selectedShop);
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

  hideShopDetailsDialog(): void {
    this.shopDetailsDialog = false;
    this.cashRegisterData = null;
    this.organizationData = null;
    this.purchaseStats = null;
    this.expenseStats = null;
    this.recentPurchases = [];
    this.recentExpenses = [];
    this.shopStats = {};
  }

  refreshShopDetails(): void {
    if (this.selectedShop?.shopId) {
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

  deleteShop(shop: Shop) {
    this.deleteShopDialog = true;
    this.shop = { ...shop };
  }

  async confirmDeleteSelected() {
    this.deleteShopsDialog = false;
    await Promise.all(this.selectedShops.map(selectedShop => this.onDeleteShop(selectedShop.shopId)));
    this.selectedShops = [];
  }

  async confirmDelete() {
    this.deleteShopDialog = false;
    await this.onDeleteShop(this.shop.shopId);
    this.shop = {};
  }

  hideDialog() {
    this.shopDialog = false;
    this.submitted = false;
    this.selectedCountry = {};
  }

  openNew() {
    this.selectedCountry = {};
    this.shop = {};
    this.submitted = false;
    this.shopDialog = true;
  }

  async openSettingsDialog() {
    this.cashRegisterSettingsDialog = true;
  }

  hideSettingsDialog() {
    this.cashRegisterSettingsDialog = false;
    this.cashRegister = {};
  }

  saveShop() {
    this.submitted = true;
    console.log(this.shop);
    if (this.shop.shopName) {
      if (this.shop.shopId) {
        this.updateShop(this.shop.shopId, this.shop)
          ? this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('shop_updated'),
            life: 3000
          })
          : this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_updating_shop'),
            life: 3000
          });
      } else {
        this.addShop(this.shop)
          ? this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('shop_added'),
            life: 3000
          })
          : this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_adding_shop'),
            life: 3000
          });
      }
      this.shops = [...this.shops];
      this.shopDialog = false;
      this.shop = {};
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
      return;
    }
  }

  updateCashRegister() {
    this.submitted = true;

    // Check if openingTime and closingTime exist and format them
    if (this.cashRegister.openingTime && this.cashRegister.closingTime) {
      // Function to format Date object as a LocalTime string ("HH:mm:ss")
      const formatDateToLocalTime = (date: Date): string => {
        return date.toTimeString().split(' ')[0]; // Extracts "HH:mm:ss" portion
      };

      // Format openingTime and closingTime to LocalTime strings
      this.cashRegister.openingTime = formatDateToLocalTime(new Date(this.cashRegister.openingTime));
      this.cashRegister.closingTime = formatDateToLocalTime(new Date(this.cashRegister.closingTime));

      // Call saveCashRegister with formatted cashRegister data
      const success = this.saveCashRegister(this.shop.shopId, this.cashRegister);

      // Show success or error message based on the result
      success
        ? this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('cash_register_updated'),
          life: 3000
        })
        : this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_updating_cash_register'),
          life: 3000
        });

      // Close dialog and reset cashRegister object
      this.cashRegisterSettingsDialog = false;
      this.cashRegister = {};
    } else {
      // Show error if required fields are missing
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
      return;
    }
  }

  closeCashRegisterDialog() {
    this.cashRegisterDialog = false;
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }


  clear(table: Table) {
    table.clear();
  }

  getSeverity(status: any) {
    switch (status) {
      case false:
        return 'danger';

      case true:
        return 'success';

      case 'new':
        return 'info';

      case 'negotiation':
        return 'warning';

      case 'renewal':
        return null;

      default:
        return '';
    }
  }

  async onGetAllShops() {
    await (await this.shopService.getShops())
      .subscribe({
        next: (response: any) => {
          this.shops = response;
          this.shops.forEach((shop: any) => (shop.creationDate = new Date(<Date>shop.creationDate)));
          console.log(this.shops);
        },
        error: (err: any) => {
          console.log(err)
        },
        complete: () => {
          this.isLoading = false;
        },
      })
  }

  private convertTimeStringToDate(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  async onGetShopCashRegister(): Promise<void> {
    try {
      const response = await (this.shopService.getCashRegister(this.shop.shopId)).toPromise();
      this.cashRegister = response || {};

      // Convert time strings to Date objects
      if (this.cashRegister.openingTime && this.cashRegister.closingTime) {
        if (typeof this.cashRegister.openingTime === 'string') {
          this.cashRegister.openingTime = this.convertTimeStringToDate(this.cashRegister.openingTime);
        }
        if (typeof this.cashRegister.closingTime === 'string') {
          this.cashRegister.closingTime = this.convertTimeStringToDate(this.cashRegister.closingTime);
        }
      }

      this.filterByDateRange();
      this.calculateTotalsAndTrends();
    } catch (err) {
      console.error('Error loading cash register:', err);
      // Initialize empty cash register if load fails
      this.cashRegister = {};
      // Don't show error message here - let the caller handle it
      throw err;
    }
  }

  async onDeleteShop(id: any) {
    await (await this.shopService.deleteShop(id))
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllShops();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('shop_deleted'),
            life: 3000
          });
        },
        error: (err: any) => {
          console.log(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_deleting_shop'),
            life: 3000
          });
        },
      });
  }

  async updateShop(id: any, shop: any): Promise<any> {
    this.shopService.updateShop(id, shop)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllShops();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  async saveCashRegister(id: any, cashRegister: any): Promise<any> {
    console.log(cashRegister)
    await this.shopService.updateCashRegister(id, cashRegister)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetShopCashRegister();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  async addShop(data: any): Promise<any> {
    await (await this.shopService.saveShop(data))
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllShops();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  onChangeCountry() {
    this.shop.city = undefined;
    console.log("clear city")
  }

  onSelectedCountry(event) {
    if ((this.shop.country != this.selectedCountry) && (this.shop.city == undefined)) this.shop.city = undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    this.states = this.locationService.getStatesByCountryCode(this.selectedCountry.isoCode);
  }

  filterCountry(value: any, filter: string): boolean {
    // Convert both to lowercase for case-insensitive comparison
    const normalizedFilter = filter.toLowerCase();

    // Check both original name and translated name
    return (
      value.name.toLowerCase().includes(normalizedFilter) ||
      value.translatedName.toLowerCase().includes(normalizedFilter)
    );
  }

  openCashRegisterDialog(shop: any): void {
    if (!shop?.shopId) {
      console.error('Cannot open cash register dialog: shop ID is missing');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: 'Shop ID is missing',
        life: 3000
      });
      return;
    }

    console.log('🔄 Opening cash register dialog for shop:', shop.shopId);

    // Set shop first
    this.shop = shop;

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

    // Open dialog IMMEDIATELY - no async operations blocking this
    this.cashRegisterDialog = true;
    
    // Force change detection to ensure dialog opens
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
        this.refreshData(false),
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
      // Always clear global loading state (sessions + collections)
      console.log('🔓 Clearing loading state - before:', this.loadingCashRegister);
      this.loadingCashRegister = false;
      console.log('🔓 Clearing loading state - after:', this.loadingCashRegister);

      // Ensure UI updates
      this.ngZone.run(() => {
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });

      console.log('🔓 Loading complete');
    }
  }

  /**
   * Called when the Movements tab is opened.
   * Loads movements lazily and uses its own spinner, without affecting the main dialog loader.
   */
  async onMovementsTabOpen(): Promise<void> {
    console.log('📑 Movements tab opened');
    if (this.movements && this.movements.length > 0) {
      return; // already loaded
    }
    await this.loadMovements();
  }

  openCashRegisterSessionDialog(): void {
    this.showCashRegisterSessionDialog = true;
  }

  onSessionOpened(session: CashRegisterSession): void {
    console.log('✅ Cash register session opened:', session);
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('success'),
      detail: this.translate.instant('cash_register_opened'),
      life: 3000
    });
    // Refresh data (which includes sessions) - manage loading state since dialog is already open
    if (this.cashRegisterDialog) {
      this.refreshData(true);
    }
  }

  onSessionClosed(session: CashRegisterSession): void {
    console.log('🔴 Cash register session closed:', session);
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: this.translate.instant('cash_register_closed'),
      life: 3000
    });
    // Refresh data (which includes sessions) - manage loading state since dialog is already open
    if (this.cashRegisterDialog) {
      this.refreshData(true);
    }
  }

  onCashRegisterSessionDialogClosed(): void {
    this.showCashRegisterSessionDialog = false;
  }

  // async fetchCashRegisterData(shopId: number): Promise<void> {
  //   try {
  //     const data = await (await this.shopService.fetchCashRegisterData(shopId)).toPromise();
  //     console.log('Fetched cash register data:', data);
  //     const balances: DailyBalance[] = Array.isArray(data) ? data : [];
  //     this.dailyBalances = balances.map(balance => ({
  //       ...balance,
  //       balanceDate: new Date(balance.balanceDate).toISOString() // Convert to string as required by DailyBalance
  //     }));
  //     this.filteredBalances = [...this.dailyBalances];
  //     this.calculateTotalDailyDifference(this.filteredBalances);
  //   } catch (error) {
  //     console.error('Error fetching cash register data:', error);
  //     this.messageService.add({
  //       severity: 'error',
  //       summary: 'Error',
  //       detail: 'Failed to fetch daily balances'
  //     });
  //   }
  // }

  formatDateForFilter(date: any): Date {
    if (!date) return null;
    if (date instanceof Date) return date;
    return new Date(date);
  }

  // filterByDateRange() {
  //   // Validate dates
  //   if (this.startDate && this.endDate && this.startDate > this.endDate) {
  //     this.messageService.add({
  //       severity: 'warn',
  //       summary: this.translate.instant('invalid_date_range'),
  //       detail: this.translate.instant('start_date_cannot_be_after_end_date')
  //     });
  //     return;
  //   }

  //   // If both dates are selected, filter balances
  //   if (this.startDate && this.endDate) {
  //     const start = new Date(this.startDate);
  //     const end = new Date(this.endDate);
  //     end.setHours(23, 59, 59, 999); // Include entire end day

  //     this.filteredBalances = this.dailyBalances.filter((balance) => {
  //       const balanceDate = new Date(balance.balanceDate);
  //       return balanceDate >= start && balanceDate <= end;
  //     });
  //   } else {
  //     // Show all balances if no filter
  //     this.filteredBalances = [...this.dailyBalances];
  //   }

  //   // Calculate totals
  //   this.calculateTotalDailyDifference(this.filteredBalances);
  //   this.calculateTotalsAndTrends();
  // }

  filterByDateRange(): void {
    if (this.startDate && this.endDate) {
      this.filteredSessions = this.sessions.filter(s =>
        new Date(s.openedAt) >= this.startDate && new Date(s.openedAt) <= this.endDate
      );
    } else {
      this.filteredSessions = [...this.sessions];
    }
  }

  clearDateFilter(): void {
    this.startDate = this.endDate = null;
    this.filteredSessions = [...this.sessions];
  }

  // async viewSessionMovements(session: CashRegisterSession): Promise<void> {
  //   try {
  //     const movements$ = this.cashRegisterService.getMovementsBySession(session.sessionId);
  //     this.selectedSessionMovements = await firstValueFrom(movements$);
  //     this.movementsDialogVisible = true;
  //   } catch (error) {
  //     console.error('❌ Error loading movements:', error);
  //   }
  // }

  async refreshData(manageLoadingState: boolean = false): Promise<void> {
    if (!this.shop?.shopId) {
      console.warn('⚠️ Cannot refresh data: shop ID is missing');
      return;
    }
    
    console.log('🔄 Refreshing cash register data for shop:', this.shop.shopId);
    
    if (manageLoadingState) {
      this.loadingCashRegister = true;
    }
    
    try {
      // Use allSettled to ensure all calls complete even if some fail
      const results = await Promise.allSettled([
        this.loadSessions(),
        this.loadCollections(),
        this.loadMovements()
      ]);
      
      // Check for any failures
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn('⚠️ Some data loading failed:', failures);
      }
      
      // Calculate stats once after all data is loaded (even if some failed)
      this.calculateCashRegisterStats();
      console.log('✅ Cash register stats calculated');
      
      if (manageLoadingState) {
        this.loadingCashRegister = false;
      }
    } catch (error) {
      console.error('❌ Error refreshing cash register data:', error);
      if (manageLoadingState) {
        this.loadingCashRegister = false;
      }
      // Initialize empty stats on error
      this.cashRegisterStats = {};
      // Don't re-throw - let allSettled handle it
    }
  }

  calculateTotalDailyDifference(balances: DailyBalance[]) {
    this.totalDailyDifference = balances.reduce((total, balance) => {
      return total + balance.dailyDifference;
    }, 0);
  }


  exportPdf() {
    this.reportingService.exportPdf(this.exportColumns, this.shops, 'shops')
  }

  exportExcel() {
    // Clone the suppliers array to avoid modifying the original array
    const modifiedShops = this.shops.map(shop => {
      // Create a copy of the supplier object to modify
      const modifiedShop = { ...shop };

      // Remove the column you want to exclude
      delete modifiedShop.creationDate;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedSupplier['columnToRemove'];

      return modifiedShop;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedShops, 'shops');
  }

  openNewCollectionDialog(): void {
    this.newCollectionDialogVisible = true;
    this.newCollection = {
      amount: null,
      notes: ''
    };
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
      const shopId = this.shop.shopId;
      const { amount, notes } = this.newCollection;

      const response = await firstValueFrom(
        await this.cashRegisterService.addCollection(shopId, amount, notes)
      );

      // Optionally update local collection list if backend returns it
      if (response) {
        this.collections.unshift(response);
      }

      this.newCollectionDialogVisible = false;

      this.messageService.add({
        severity: 'success',
        summary: 'Collection Performed',
        detail: 'Cash collection has been successfully recorded.',
        life: 3000
      });

      // refresh the cash register data to reflect new balance
      if (this.cashRegisterDialog) {
        this.refreshData(true);
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

  openNewDepositDialog() {
  this.newDepositDialogVisible = true;
  this.newDeposit = { amount: null, notes: '' };
}

  async saveNewDeposit() {
  if (!this.newDeposit.amount || this.newDeposit.amount <= 0) {
    this.messageService.add({ severity: 'warn', summary: this.translate.instant('warning'), detail: this.translate.instant('amount_must_be_greater_than_zero') });
    return;
  }

  (await this.cashRegisterService.depositMoney(this.cashRegister.cashRegisterId, this.newDeposit)).subscribe({
    next: () => {
      this.messageService.add({ severity: 'success', summary: this.translate.instant('success'), detail: this.translate.instant('deposit_added') });
      this.newDepositDialogVisible = false;
      if (this.cashRegisterDialog) {
        this.refreshData(true);
      }
    },
    error: (err) => {
      this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('error_adding_deposit') });
      console.error(err);
    }
  });
}
}
