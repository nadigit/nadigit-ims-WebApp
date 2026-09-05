import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { MenuItem, MessageService } from 'primeng/api';

import { Subject, Subscription, catchError, debounceTime, firstValueFrom, forkJoin, of, takeUntil, map, from, switchMap, timeout } from 'rxjs';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { QuantityScale } from 'src/app/utils/quantity-scale.util';
import { displayWarehouseStockQuantity, formatLineQuantity, getLineMeasureUnit } from 'src/app/shared/product-utils';
import { OrderService } from 'src/app/services/order.service';
import { ProductService } from 'src/app/services/product.service';
import { CustomerService } from 'src/app/services/customer.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { PurchaseService } from 'src/app/services/purchase.service';
import { ExpenseService } from 'src/app/services/expense.service';
import { KeycloakService } from 'keycloak-angular';
import { Order } from 'src/app/models/order';
import { Product } from 'src/app/models/product';
import { Customer } from 'src/app/models/customer';
import { WarehouseTransferService } from 'src/app/services/warehouse-transfer.service';
import { PaymentService } from 'src/app/services/payment.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import { DashboardService, DashboardOverview } from 'src/app/services/dashboard.service';
import { AnalysisService, ProfitAnalysis, ProfitPeriod } from 'src/app/services/analysis.service';
import { AiIntegrationService, NadiPilotBriefingDTO } from 'src/app/services/ai-integration.service';
import {
  BRAND_COLORS,
  getBrandCssColors,
  getBrandCssHoverColors,
  getChartThemeColors,
} from 'src/app/utils/brand-colors';


// Utility function for memoization
function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map();
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * What a dashboard data source knows about its own records.
 * 'absent' is a *confirmed* empty (the request succeeded and returned nothing); 'unknown' means the
 * request failed, which must never be treated as "this tenant has no data".
 */
type OnboardingSignal = 'pending' | 'present' | 'absent' | 'unknown';

@Component({
  styleUrls: ['./dashboard.component.css'],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {


  // Component state
  isLoading = true;
  isAdmin = false;
  isVendor = false;

  // Data arrays
  orders: Order[] = [];
  todayOrders: Order[] = [];
  products: Product[] = [];
  customers: Customer[] = [];
  top5Products: Product[] = [];
  recentOrderedProducts: Product[] = [];
  lastWeekProducts: Product[] = [];
  todayCustomers?: Customer[] = [];
  totalProducts = 0;
  totalOrders = 0;


  // Metrics
  revenue = 0;
  todayRevenue = 0;
  yesterdayRevenue = 0;
  revenueDifferencePercentage = 0;
  totalOrderedProducts = 0;
  totalSales = 0;

  // Statistics
  ordersStatistics: any[] = [];
  expensesStatistics: any[] = [];
  purchasesStatistics: any[] = [];

  // Charts
  chartData: any = null;
  chartOptions: any = null;
  pieData: any = null;
  pieOptions: any = null;
  barData: any = null;
  barOptions: any = null;
  chartsInitialized = false; // Flag to prevent multiple initializations
  chartDataReady = false; // Flag to indicate chart data is ready for rendering
  pieDataReady = false; // Flag to indicate pie chart data is ready for rendering
  chartRenderReady = false; // Flag to defer actual chart DOM rendering
  pieChartRenderReady = false; // Flag to defer actual pie chart DOM rendering

  // Product status
  outOfStockProducts: any[] = [];
  lowStockProducts: any[] = [];
  canceledOrders: any[] = [];
  deliveredOrders: any[] = [];

  // Warehouse
  warehouseProductCounts: { [key: string]: number } = {};

  // Admin command-center overview (accurate, backend-aggregated)
  overview?: DashboardOverview;
  overviewLoading = false;
  /** Flips true after the first overview attempt resolves (success OR failure) — the skeleton keys
   *  off this so a failed load ends in an empty stage rather than a skeleton that shimmers forever. */
  overviewAttempted = false;

  // NadiPilot AI briefing (replaces the rule-based summary once it arrives; falls back on failure)
  aiBriefing?: NadiPilotBriefingDTO;
  aiBriefingLoading = false;

  /**
   * "NadiPilot is thinking" state. The LLM briefing can take several seconds, so instead of an
   * anonymous spinner we narrate what it is doing — a rotating step label. Saying *what* is
   * happening measurably shortens the perceived wait, and the rule-based clauses stay on screen
   * underneath so no real information is ever hidden behind the wait.
   */
  private static readonly THINKING_STEPS = [
    'nadipilot_thinking_reading',
    'nadipilot_thinking_stock',
    'nadipilot_thinking_comparing',
    'nadipilot_thinking_writing',
  ];
  /** Index into THINKING_STEPS; advances while the briefing is in flight, never wraps past the last. */
  thinkingStepIndex = 0;
  /** Set once the AI briefing has landed, so the template can cross-fade it in instead of jump-cutting. */
  aiBriefingSettled = false;
  private thinkingTimer: any = null;
  selectedPeriod: ProfitPeriod = ProfitPeriod.MONTH;
  readonly ProfitPeriod = ProfitPeriod;
  periodOptions: { label: string; value: ProfitPeriod }[] = [];

  // 12-month trend context (for KPI sparklines + the profit & cash trend chart)
  revenueSparkline: number[] = [];
  netProfitSparkline: number[] = [];
  grossProfitSparkline: number[] = [];
  profitTrendData: any = null;
  profitTrendOptions: any = null;
  profitTrendReady = false;

  // Admin-specific metrics
  totalStockValue = 0;
  unpaidReceivables = 0;
  unpaidPayables = 0;
  pendingTransfers = 0;
  overdueTransfers = 0;
  totalExpensesMTD = 0;
  totalPurchasesMTD = 0;
  grossMarginPercentage = 0;
  criticalAlerts: any[] = [];
  isWarehouseman = false;
  isWarehouseTransfersFeatureEnabled = true;

  // Vendor-specific metrics
  vendorTodaySales = 0;
  vendorPendingPayments = 0;
  vendorUnpaidOrders = 0;
  vendorTopSellingProducts: any[] = [];
  vendorRecentCustomers: Customer[] = [];

  // Warehouseman-specific metrics
  warehouseTotalProducts = 0;
  warehouseLowStockCount = 0;
  warehouseOutOfStockCount = 0;
  warehousePendingTransfers = 0;
  warehouseRecentMovements: any[] = [];
  assignedWarehouse: any = null;

  currency = 'USD';
  userRoles: string[] = [];
  productPercentages: any[] = [];

  // Dashboard refresh
  refreshDashboardLoading: boolean = false;

  // Getting Started onboarding card
  showGettingStartedCard: boolean = true;
  currentUsername: string = '';
  // Set once the analytics forkJoin resolves. NOT an onboarding gate — see onboardingSignals below;
  // keying the banner off this flag is precisely what made it flicker.
  dataLoaded: boolean = false;

  /**
   * Onboarding readiness, tracked per data source.
   *
   * The banner used to key off {@link dataLoaded}, which flips as soon as the *products* forkJoin
   * resolves — while orders and customers are still in flight in a separate, later request. That
   * left two visible defects:
   *   1. Flicker — products landed first, orders/customers still read 0, the banner appeared, then
   *      vanished a moment later when the second request resolved.
   *   2. False positives — every source loader swallows its error into `of([])`, so a 403/timeout
   *      is indistinguishable from an empty tenant and the banner nagged established customers.
   *
   * So each source now reports what it actually knows: 'present' / 'absent' (a real, successful
   * empty) / 'unknown' (the request failed — we may not conclude anything). The banner renders only
   * once every source the current role depends on has reported, and never while any is 'unknown'.
   */
  private onboardingSignals: {
    products: OnboardingSignal;
    orders: OnboardingSignal;
    customers: OnboardingSignal;
  } = { products: 'pending', orders: 'pending', customers: 'pending' };

  /**
   * Latches once setup is confirmed complete. A later cache miss or a failing refresh must never
   * bring the onboarding banner back for a customer who is already up and running.
   */
  private setupConfirmedComplete = false;

  // Private properties for performance optimization
  private destroy$ = new Subject<void>();
  private cache = new Map<string, { data: any, timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private subscriptions: any[] = [];
  subscription!: Subscription;



  // items!: MenuItem[];





  constructor(private orderService: OrderService,
    private productService: ProductService,
    private purchaseService: PurchaseService,
    private expenseService: ExpenseService,
    private warehouseService: WarehouseService,
    private customerService: CustomerService,
    private warehouseTransferService: WarehouseTransferService,
    private paymentService: PaymentService,
    public layoutService: LayoutService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    public keycloakService: KeycloakService,
    public messageService: MessageService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
    private dashboardService: DashboardService,
    private analysisService: AnalysisService,
    private aiService: AiIntegrationService
  ) {
    this.subscription = this.layoutService.configUpdate$
      .pipe(debounceTime(25))
      .subscribe((config) => {
        this.initChart();
      });

  }

  async ngOnInit() {
    this.isLoading = true;
    this.cdr.markForCheck();

    // Get current user's username for user-specific preferences
    try {
      const profile = await this.keycloakService.loadUserProfile();
      this.currentUsername = profile.username || profile.id || 'default';
    } catch (error) {
      console.warn('Could not load user profile, using default username');
      this.currentUsername = 'default';
    }

    // Load getting started card visibility preference from localStorage (user-specific)
    const userPreferenceKey = `dashboard_showGettingStarted_${this.currentUsername}`;
    const savedPreference = localStorage.getItem(userPreferenceKey);
    this.showGettingStartedCard = savedPreference !== 'false'; // Default to true if not set

    // Set a maximum timeout - always show dashboard after 5 seconds even if data isn't loaded
    const maxTimeout = setTimeout(() => {
      if (this.isLoading) {
        console.warn('Dashboard loading timeout - showing dashboard with available data');
        this.isLoading = false;
        this.cdr.markForCheck();
        this.messageService.add({
          severity: 'info',
          summary: this.translate.instant('dashboard_loading'),
          detail: this.translate.instant('dashboard_loaded_with_some_data_loading'),
          life: 3000
        });
      }
    }, 5000);

    try {
      await this.loadLicenseCapabilities();
    } catch (error) {
      console.warn('Unable to resolve license capabilities for dashboard.', error);
    }

    try {
      // Load critical data first for initial render with timeout
      // Use Promise.race to ensure we don't hang forever
      await Promise.race([
        this.loadCriticalData(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Critical data loading timeout')), 8000)
        )
      ]);

      clearTimeout(maxTimeout);

      // Setup reactive subscriptions
      // Hide loading spinner immediately after critical data loads
      // This allows users to see the dashboard while heavy data loads in background
      this.isLoading = false;
      this.cdr.markForCheck();

      // Auto-draw the Sales Overview + Inventory charts. Kicking this off in the same tick that
      // reveals the dashboard flips chartsInitialized=true before the first render, so the old
      // "Load Chart" button never shows — the chart loads itself (spinner → chart). loadChartOnDemand
      // fetches its own (cached) data and is internally staggered, so it stays off the render path.
      this.loadChartOnDemand();

      // Load secondary data after initial render (non-blocking)
      this.loadSecondaryData();

      // Load heavy components with delay (non-blocking)
      setTimeout(() => {
        this.loadHeavyComponents();
      }, 300);

    } catch (error) {
      clearTimeout(maxTimeout);
      console.error('Error initializing dashboard:', error);
      // Always ensure loading is set to false, even on error or timeout
      this.isLoading = false;
      this.cdr.markForCheck();
      
      // Show error message to user
      this.messageService.add({
        severity: 'warn',
        summary: 'Dashboard Loading',
        detail: 'Some data may still be loading. Please refresh if needed.',
        life: 3000
      });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    this.stopThinkingSteps();

    if (this.heroAnimHandle) {
      cancelAnimationFrame(this.heroAnimHandle);
      this.heroAnimHandle = null;
    }

    // Clear all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];

    // Clear cache
    this.cache.clear();
  }


  // ==================== CRITICAL DATA LOADING ====================

  private async loadCriticalData() {
    try {
      await this.setUserRoles();
    } catch (error) {
      console.error('Error setting user roles:', error);
    }
    
    try {
      await this.loadUserPreferences();
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
    
    try {
      await this.loadTodayMetrics();
    } catch (error) {
      console.error('Error loading today metrics:', error);
      // Set defaults to prevent undefined errors
      this.todayOrders = [];
      this.todayCustomers = [];
      this.todayRevenue = 0;
    }
    
  }

  private async loadUserPreferences() {
    // Combine currency and language loading
    const currencySub = this.configService.currency$
      .pipe(takeUntil(this.destroy$))
      .subscribe(currency => {
        if (currency) {
          this.currency = currency;
        }
      });

    const languageSub = this.translateService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(lang => {
        this.translate.use(lang);
      });

    this.subscriptions.push(currencySub, languageSub);
  }

  private async loadTodayMetrics() {
    // The sales/customer "today" endpoints require order/customer read access, which warehouse-only
    // roles don't have. Skip the calls for them so their dashboard stays clean (no 403s, no empty
    // sales cards). setUserRoles() runs before this in loadCriticalData, so roles are known here.
    if (!this.isAdmin && !this.isVendor) {
      this.todayOrders = [];
      this.todayCustomers = [];
      this.todayRevenue = 0;
      this.categorizeOrdersByStatus();
      return;
    }
    try {
      // Use firstValueFrom instead of deprecated toPromise()
      // Add timeout to prevent hanging
      const [todayOrders, todayCustomers] = await Promise.all([
        firstValueFrom(
          this.getTodayOrders().pipe(
            timeout(8000),
            catchError(err => {
              console.error('Error loading today orders:', err);
              return of([]);
            })
          )
        ),
        firstValueFrom(
          this.getTodayCustomers().pipe(
            timeout(8000),
            catchError(err => {
              console.error('Error loading today customers:', err);
              return of([]);
            })
          )
        )
      ]);

      this.todayOrders = (todayOrders as Order[]) || [];
      this.todayCustomers = (todayCustomers as Customer[]) || [];
      this.todayRevenue = this.calculateRevenue(this.todayOrders);
      this.categorizeOrdersByStatus();

    } catch (error) {
      console.error('Error loading today metrics:', error);
      // Set defaults to prevent undefined errors
      this.todayOrders = [];
      this.todayCustomers = [];
      this.todayRevenue = 0;
    }
  }

  // ==================== SECONDARY DATA LOADING ====================

  private loadSecondaryData() {
    forkJoin({
      ordersResponse: this.getOrders(),
      totalOrderedProducts: this.getTotalOrderedProducts(),
      recentOrderedProducts: this.getRecentOrderedProducts(),
      customers: this.getCustomers()
    })
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading secondary data:', error);
          return of({
            ordersResponse: { content: [] },
            totalOrderedProducts: 0,
            recentOrderedProducts: [],
            customers: []
          });
        })
      )
      .subscribe((data: any) => {

        // If backend returns pagination object
        const ordersResponse = data.ordersResponse;
        if (Array.isArray(ordersResponse)) {
          this.orders = ordersResponse;
        } else if (ordersResponse?.content) {
          this.orders = ordersResponse.content;
          // Try to get total from various possible response structures
          if (ordersResponse.totalOrders !== undefined) {
            this.totalOrders = ordersResponse.totalOrders;
          } else if (ordersResponse.page?.totalElements !== undefined) {
            this.totalOrders = ordersResponse.page.totalElements;
          } else if (ordersResponse.totalElements !== undefined) {
            this.totalOrders = ordersResponse.totalElements;
          }
        } else if (ordersResponse?.page?.content) {
          this.orders = ordersResponse.page.content;
          if (ordersResponse.page.totalElements !== undefined) {
            this.totalOrders = ordersResponse.page.totalElements;
          } else if (ordersResponse.totalOrders !== undefined) {
            this.totalOrders = ordersResponse.totalOrders;
          }
        } else {
          this.orders = [];
        }

        this.totalOrderedProducts = data.totalOrderedProducts ?? 0;
        this.recentOrderedProducts = data.recentOrderedProducts ?? [];
        this.customers = data.customers ?? [];

        this.calculateRevenueMetrics();
        this.loadOrders();
        this.cdr.markForCheck();
      });
  }


  // ==================== HEAVY COMPONENTS LOADING ====================

  private loadHeavyComponents() {
    this.loadAnalyticsData(); // Charts will be initialized inside loadAnalyticsData after data loads
    if (this.isAdmin) {
      this.buildPeriodOptions();
      this.loadOverview();
      this.loadAiBriefing();
      this.loadAdminMetrics();
    } else if (this.isVendor) {
      this.loadVendorMetrics();
    } else if (this.isWarehouseman) {
      this.loadWarehousemanMetrics();
    }
  }

  // ==================== ADMIN COMMAND-CENTER OVERVIEW ====================

  private buildPeriodOptions() {
    if (this.periodOptions.length > 0) {
      return;
    }
    this.periodOptions = [
      { label: this.tr('Today'), value: ProfitPeriod.TODAY },
      { label: this.tr('Yesterday'), value: ProfitPeriod.YESTERDAY },
      { label: this.tr('This Week'), value: ProfitPeriod.WEEK },
      { label: this.tr('This Month'), value: ProfitPeriod.MONTH },
      { label: this.tr('Last 6 Months'), value: ProfitPeriod.LAST_SIX_MONTHS },
      { label: this.tr('This Year'), value: ProfitPeriod.YEAR },
      { label: this.tr('Last 12 Months'), value: ProfitPeriod.LAST_12_MONTHS },
    ];
  }

  /** translate.instant with the English key itself as fallback (keys mirror the Reports module). */
  private tr(key: string): string {
    const value = this.translate.instant(key);
    return value && value !== key ? value : key;
  }

  async loadOverview(): Promise<void> {
    if (!this.isAdmin) {
      return;
    }
    this.overviewLoading = true;
    this.cdr.markForCheck();
    this.loadTrends();
    try {
      const request$ = await this.dashboardService.getAdminOverview(this.selectedPeriod);
      const data = await firstValueFrom(
        request$.pipe(
          timeout(15000),
          catchError((error) => {
            console.error('Error loading dashboard overview:', error);
            return of(undefined as unknown as DashboardOverview);
          })
        )
      );
      this.overview = data || undefined;
      if (this.overview) {
        // Hero headline = gross profit (the operating bottom line), not net. Net profit is shown as
        // a secondary line below, so a one-off spoilage dump can't swamp the command-center headline.
        this.animateHero(this.overview.profit?.grossProfit ?? 0);
        // The priority panel is fed by this payload (stock counts, receivables), so rebuild it here
        // too — otherwise it keeps whatever loadAdminMetrics() computed before the overview landed,
        // and stays stale across a period change.
        this.buildCriticalAlerts();
      }
    } catch (error) {
      console.error('Error loading dashboard overview:', error);
    } finally {
      this.overviewLoading = false;
      this.overviewAttempted = true;
      this.cdr.markForCheck();
    }
  }

  onPeriodChange(): void {
    this.loadOverview();
  }

  /**
   * Percentage change of current vs previous comparable window.
   *
   * A percentage is only meaningful against a positive baseline. When the previous window is zero
   * or negative the ratio is misleading — e.g. a one-off spoilage dump made net profit read a flat
   * "-100%" while gross margin (positive baseline) read "+100%" on the very same screen. In those
   * cases we return null so the tile simply shows no delta arrow instead of a fabricated number.
   */
  private pctChange(current: number, previous: number): number | null {
    if (!isFinite(current) || !isFinite(previous) || previous <= 0) {
      return null;
    }
    return ((current - previous) / previous) * 100;
  }

  get revenueDeltaPercent(): number | null {
    if (!this.overview) return null;
    return this.pctChange(this.overview.profit.totalRevenue, this.overview.previous.totalRevenue);
  }

  get netProfitDeltaPercent(): number | null {
    if (!this.overview) return null;
    return this.pctChange(this.overview.profit.netProfit, this.overview.previous.netProfit);
  }

  get grossProfitDeltaPercent(): number | null {
    if (!this.overview) return null;
    return this.pctChange(this.overview.profit.grossProfit, this.overview.previous.grossProfit);
  }

  get grossMarginPercent(): number {
    const revenue = this.overview?.profit?.totalRevenue ?? 0;
    if (revenue <= 0) return 0;
    return (this.overview!.profit.grossProfit / revenue) * 100;
  }

  /** Gross profit for the window (revenue − COGS − refunds), before expenses & spoilage. */
  get grossProfitAmount(): number {
    return this.overview?.profit?.grossProfit ?? 0;
  }

  /**
   * Spoilage / inventory write-offs charged to the window. Broken out as its own line so a one-off
   * spoilage event (e.g. a batch of expirations) is legible instead of silently swamping net profit.
   */
  get spoilageAmount(): number {
    return this.overview?.profit?.totalWriteOffs ?? 0;
  }

  get hasSpoilage(): boolean {
    return this.spoilageAmount > 0;
  }

  /** Delta arrow for spoilage (lower is better — handled by the KPI card's higherIsBetter=false). */
  get spoilageDeltaPercent(): number | null {
    if (!this.overview) return null;
    return this.pctChange(this.overview.profit.totalWriteOffs, this.overview.previous.writeOffs);
  }

  /** Percentage formatted for display, capped so extreme loss ratios read cleanly (e.g. "< -999%"). */
  formatPercentCapped(pct: number | null | undefined, cap = 999): string {
    if (pct === null || pct === undefined || !isFinite(pct)) {
      return '0%';
    }
    if (Math.abs(pct) > cap) {
      return (pct > 0 ? '> ' : '< -') + cap + '%';
    }
    return pct.toFixed(1) + '%';
  }

  // ==================== COMMAND-CENTER HEADLINE (hero + NadiPilot briefing) ====================

  /** Hero figure, tweened 0 → net profit on load so the headline "lands" instead of just appearing. */
  animatedHero = 0;
  private heroAnimHandle: any = null;

  get prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Ease the hero figure from 0 to the real value (cubic ease-out); respects reduced-motion. */
  private animateHero(target: number): void {
    if (this.heroAnimHandle) {
      cancelAnimationFrame(this.heroAnimHandle);
      this.heroAnimHandle = null;
    }
    if (!isFinite(target)) {
      target = 0;
    }
    // Show the real value up front so the hero is correct even if rAF never fires — the browser
    // pauses requestAnimationFrame while the tab isn't compositing (hidden/background tab). The
    // animation below overwrites this from ~0 up once the first frame actually runs.
    this.animatedHero = target;
    this.cdr.markForCheck();
    if (this.prefersReducedMotion || typeof requestAnimationFrame === 'undefined') {
      return;
    }
    const duration = 1100;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) {
        start = now;
      }
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      this.animatedHero = p < 1 ? target * eased : target;
      this.cdr.markForCheck();
      this.heroAnimHandle = p < 1 ? requestAnimationFrame(tick) : null;
    };
    this.heroAnimHandle = requestAnimationFrame(tick);
  }

  /** SVG polyline points for a sparkline over `data` (oldest → newest). */
  private buildSparkPoints(data: number[], w = 100, h = 32): string | null {
    if (!data || data.length < 2) {
      return null;
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = w / (data.length - 1);
    return data
      .map((d, i) => `${(i * step).toFixed(1)},${(h - ((d - min) / range) * h).toFixed(1)}`)
      .join(' ');
  }

  get heroSparkPoints(): string | null {
    return this.buildSparkPoints(this.grossProfitSparkline);
  }

  /** Same line, closed to the baseline so it can be filled as an area under the hero number. */
  get heroSparkAreaPoints(): string | null {
    const line = this.heroSparkPoints;
    return line ? `0,32 ${line} 100,32` : null;
  }

  get heroDeltaText(): string {
    const v = this.grossProfitDeltaPercent;
    if (v === null || v === undefined || !isFinite(v)) {
      return '';
    }
    if (Math.abs(v) > 999) {
      return v >= 0 ? '> +999%' : '< −999%';
    }
    return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
  }

  get heroDeltaPositive(): boolean {
    return (this.grossProfitDeltaPercent ?? 0) >= 0;
  }

  /** Net profit (the true bottom line, after expenses & spoilage) — shown as the hero's secondary line. */
  get netProfitAmount(): number {
    return this.overview?.profit?.netProfit ?? 0;
  }

  get netProfitNegative(): boolean {
    return this.netProfitAmount < 0;
  }

  /**
   * Low-stock SKU count — authoritative, whole-catalogue.
   *
   * Source of truth is the backend overview ({@code inventory.lowStockSkuCount}), which classifies
   * every active non-service product live from its on-hand quantity with the canonical
   * InventoryStatus rule — the very same figure the NadiPilot briefing reports. The client-side
   * {@link lowStockProducts} array is only a filter over ONE 20-row page of products, so it can
   * never exceed 20 and contradicted the briefing on real catalogues (card 0 vs briefing 719).
   * It survives purely as the fallback for roles that cannot call the ADMIN-only overview endpoint.
   */
  get lowStockCount(): number {
    const fromOverview = this.overview?.inventory?.lowStockSkuCount;
    if (typeof fromOverview === 'number' && isFinite(fromOverview)) {
      return fromOverview;
    }
    if (this.isWarehouseman) {
      return this.warehouseLowStockCount || 0;
    }
    return this.lowStockProducts?.length || 0;
  }

  /** Out-of-stock SKU count — authoritative, whole-catalogue. See {@link lowStockCount}. */
  get outOfStockCount(): number {
    const fromOverview = this.overview?.inventory?.outOfStockSkuCount;
    if (typeof fromOverview === 'number' && isFinite(fromOverview)) {
      return fromOverview;
    }
    if (this.isWarehouseman) {
      return this.warehouseOutOfStockCount || 0;
    }
    return this.outOfStockProducts?.length || 0;
  }

  /**
   * NadiPilot-style briefing: a few already-translated clauses, each tagged with a semantic kind so
   * the template can color it. Composed from data the dashboard already loads (overview deltas +
   * low/out-of-stock counts + receivables) — no extra request, and it reads like a human summary.
   */
  get briefingSegments(): { text: string; kind: 'up' | 'down' | 'warn' | 'key' | 'plain' }[] {
    const segs: { text: string; kind: 'up' | 'down' | 'warn' | 'key' | 'plain' }[] = [];
    if (!this.overview) {
      return segs;
    }

    const npDelta = this.netProfitDeltaPercent;
    if (npDelta !== null && npDelta !== undefined && isFinite(npDelta)) {
      const arrow = npDelta >= 0 ? ' ↑' : ' ↓';
      // Format from npDelta directly — heroDeltaText now reflects GROSS profit (the hero headline).
      const deltaText = Math.abs(npDelta) > 999
        ? (npDelta >= 0 ? '> +999%' : '< −999%')
        : (npDelta >= 0 ? '+' : '') + npDelta.toFixed(1) + '%';
      segs.push({
        text: this.translate.instant('brief_net_profit', { delta: deltaText + arrow }),
        kind: npDelta >= 0 ? 'up' : 'down',
      });
    }

    const lowCount = this.lowStockCount + this.outOfStockCount;
    if (lowCount > 0) {
      segs.push({ text: this.translate.instant('brief_lowstock', { count: lowCount }), kind: 'warn' });
    }

    // Point-in-time AR (all open orders), not the period-scoped figure — see totalReceivables.
    const receivables = this.overview.totalReceivables || 0;
    if (receivables > 0) {
      segs.push({
        text: this.translate.instant('brief_receivables', { amount: this.formatBriefCurrency(receivables) }),
        kind: 'key',
      });
    }

    if (segs.length === 0) {
      segs.push({ text: this.translate.instant('brief_all_healthy'), kind: 'plain' });
    }
    return segs;
  }

  private formatBriefCurrency(value: number): string {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: this.currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${this.currency} ${Math.round(value).toLocaleString()}`;
    }
  }

  /**
   * Fetch the real NadiPilot briefing (admin only). Best-effort and non-blocking: the rule-based
   * {@link briefingSegments} render instantly, and if the AI is slow/unavailable/rate-limited we
   * simply keep that fallback — the dashboard never waits on the LLM.
   */
  async loadAiBriefing(): Promise<void> {
    if (!this.isAdmin) {
      return;
    }
    this.aiBriefingLoading = true;
    this.aiBriefingSettled = false;
    this.startThinkingSteps();
    this.cdr.markForCheck();
    try {
      const dto = await firstValueFrom(
        this.aiService.getNadiPilotBriefing().pipe(
          timeout(20000),
          catchError((error) => {
            console.warn('NadiPilot briefing unavailable — using rule-based summary.', error);
            return of(undefined as unknown as NadiPilotBriefingDTO);
          })
        )
      );
      this.aiBriefing = dto && Array.isArray(dto.items) && dto.items.length ? dto : undefined;
    } catch (error) {
      console.warn('NadiPilot briefing failed — using rule-based summary.', error);
    } finally {
      this.aiBriefingLoading = false;
      this.stopThinkingSteps();
      // Only animate an actual arrival — a silent fallback to the rule-based clauses should look
      // like nothing happened, because for the user nothing did.
      this.aiBriefingSettled = !!this.aiBriefing;
      this.cdr.markForCheck();
    }
  }

  /**
   * Rotate the "thinking" step label roughly every 2.4s, holding on the last step rather than
   * looping — a cycling list that restarts reads as "stuck", a label that settles reads as "nearly
   * there". Skipped entirely when the user prefers reduced motion (the static first step is shown).
   */
  private startThinkingSteps(): void {
    this.stopThinkingSteps();
    this.thinkingStepIndex = 0;
    if (this.prefersReducedMotion) {
      return;
    }
    this.thinkingTimer = setInterval(() => {
      if (this.thinkingStepIndex < DashboardComponent.THINKING_STEPS.length - 1) {
        this.thinkingStepIndex++;
        this.cdr.markForCheck();
      }
    }, 2400);
  }

  private stopThinkingSteps(): void {
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = null;
    }
  }

  /** Current "NadiPilot is thinking" step label. */
  get thinkingStepLabel(): string {
    const key = DashboardComponent.THINKING_STEPS[this.thinkingStepIndex]
      ?? DashboardComponent.THINKING_STEPS[0];
    return this.translate.instant(key);
  }

  /**
   * True while the command centre has nothing to show yet — the skeleton stands in for the real
   * stage at the same dimensions, so the hero arriving is a fill-in rather than a page jump.
   */
  get commandCenterSkeleton(): boolean {
    return this.isAdmin && !this.overview && !this.overviewAttempted;
  }

  private severityToKind(severity: string): 'up' | 'down' | 'warn' | 'key' | 'plain' {
    switch ((severity || '').toLowerCase()) {
      case 'positive':
        return 'up';
      case 'critical':
      case 'danger':
        return 'down';
      case 'warning':
        return 'warn';
      case 'info':
        return 'key';
      default:
        return 'plain';
    }
  }

  /** Optional AI headline sentence shown above the briefing clauses. */
  get briefingHeadline(): string | null {
    const h = this.aiBriefing?.headline?.trim();
    return h ? h : null;
  }

  /** The clauses actually rendered: NadiPilot items when available, else the rule-based fallback. */
  get displayBriefingSegments(): { text: string; kind: 'up' | 'down' | 'warn' | 'key' | 'plain'; route?: string }[] {
    const items = this.aiBriefing?.items;
    if (items && items.length) {
      return items.map((it) => ({
        text: it.text,
        kind: this.severityToKind(it.severity),
        route: it.navigation?.route || undefined,
      }));
    }
    return this.briefingSegments;
  }

  /** Navigate from a clickable briefing clause (defensively strips a stale /webconsole prefix). */
  goToBriefing(route?: string): void {
    if (!route) {
      return;
    }
    const clean = route.replace(/^\/?webconsole/, '');
    this.router.navigate([clean.startsWith('/') ? clean : '/' + clean]);
  }

  /** Open the NadiPilot copilot panel (same launcher the topbar uses). Only opens — never toggles
   * an already-open panel shut. */
  openNadiPilot(): void {
    if (!this.layoutService.copilotPanelOpen()) {
      this.layoutService.requestCopilotToggle();
    }
  }

  /** Top customers in the legacy template shape, sourced from the accurate overview endpoint. */
  get topCustomersByRevenue(): { customer: any; revenue: number }[] {
    return (this.overview?.topCustomers ?? []).map((c) => ({
      customer: {
        customerId: c.customerId,
        companyName: c.displayName,
        firstName: '',
        lastName: '',
        email: c.email,
      },
      revenue: c.revenue,
    }));
  }

  /** Fetch the 12-month profit trend → KPI sparklines + the profit & cash trend chart. */
  async loadTrends(): Promise<void> {
    if (!this.isAdmin) {
      return;
    }
    try {
      const request$: any = await this.analysisService.getProfitTrends(this.selectedPeriod);
      const trends = await firstValueFrom(
        request$.pipe(
          timeout(15000),
          catchError((error: any) => {
            console.error('Error loading profit trends:', error);
            return of([] as ProfitAnalysis[]);
          })
        )
      );
      this.applyTrends(Array.isArray(trends) ? (trends as ProfitAnalysis[]) : []);
    } catch (error) {
      console.error('Error loading profit trends:', error);
    }
  }

  private applyTrends(trends: ProfitAnalysis[]): void {
    this.revenueSparkline = trends.map((t) => t?.totalRevenue ?? 0);
    this.grossProfitSparkline = trends.map((t) => t?.grossProfit ?? 0);
    this.netProfitSparkline = trends.map((t) => t?.netProfit ?? 0);

    const labels = trends.map((t) => {
      const d = t?.startDate ? new Date(t.startDate) : null;
      return d ? d.toLocaleString('default', { month: 'short' }) : '';
    });

    const theme = getChartThemeColors();
    this.profitTrendData = {
      labels,
      datasets: [
        {
          label: this.tr('revenue'),
          data: this.revenueSparkline,
          borderColor: BRAND_COLORS.premium,
          backgroundColor: BRAND_COLORS.premium,
          fill: false,
          tension: 0.4,
        },
        {
          label: this.tr('gross_profit'),
          data: this.grossProfitSparkline,
          borderColor: BRAND_COLORS.saas,
          backgroundColor: BRAND_COLORS.saas,
          fill: false,
          tension: 0.4,
        },
        {
          label: this.tr('net_profit'),
          data: this.netProfitSparkline,
          borderColor: BRAND_COLORS.success,
          backgroundColor: BRAND_COLORS.success,
          fill: false,
          tension: 0.4,
        },
      ],
    };
    this.profitTrendOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: theme.textColor } } },
      scales: {
        x: {
          ticks: { color: theme.textColorSecondary },
          grid: { color: theme.surfaceBorder, drawBorder: false },
        },
        y: {
          ticks: { color: theme.textColorSecondary },
          grid: { color: theme.surfaceBorder, drawBorder: false },
          beginAtZero: true,
        },
      },
    };
    this.profitTrendReady = true;
    this.cdr.markForCheck();
  }

  private loadAnalyticsData() {
    forkJoin({
      top5Products: this.getTop5Products(),
      products: this.getProducts(),
      lastWeekProducts: this.getProductsOfLastWeek(),
      ordersStatistics: this.loadOrdersMonthlyStatistics(),
      expensesStatistics: this.loadExpensesMonthlyStatistics(),
      purchasesStatistics: this.loadPurchasesMonthlyStatistics()
    })
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading analytics data:', error);
          return of({
            top5Products: [],
            products: [],
            lastWeekProducts: [],
            ordersStatistics: [],
            expensesStatistics: [],
            purchasesStatistics: []
          });
        })
      )
      .subscribe((data: { top5Products: Product[]; products: Product[]; lastWeekProducts: Product[]; ordersStatistics: any[]; expensesStatistics: any[]; purchasesStatistics: any[] }) => {
        this.top5Products = data.top5Products;
        this.products = data.products;
        this.lastWeekProducts = data.lastWeekProducts;
        this.ordersStatistics = data.ordersStatistics;
        this.expensesStatistics = data.expensesStatistics;
        this.purchasesStatistics = data.purchasesStatistics;
        
        // Recalculate product percentages now that top5Products is loaded
        if (this.orders && this.orders.length > 0) {
          this.loadOrders();
        }

        this.updateProductStatus();
        this.updateWarehouseProductCounts();
        
        // Mark data as loaded after products are loaded (totalProducts is set in getProducts())
        this.dataLoaded = true;
        this.cdr.markForCheck();
        
        // Note: Stock value will be calculated in loadAdminMetrics() with all products
        // for more accurate calculation
        
        // DON'T initialize charts automatically - let them load on demand when user scrolls
        // This prevents blocking the dashboard
        // Charts will be initialized lazily when they come into view
        
        this.cdr.markForCheck();
      });
  }

  // ==================== CACHING STRATEGY ====================

  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }


  // ==================== OPTIMIZED DATA METHODS ====================

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
    this.isVendor = this.userRoles.includes('VENDOR');
    this.isWarehouseman = this.userRoles.includes('WAREHOUSEMAN');
  }

  private async loadLicenseCapabilities(): Promise<void> {
    await this.licenseCapabilitiesService.ensureLoaded();
    this.isWarehouseTransfersFeatureEnabled = this.licenseCapabilitiesService.isFeatureEnabled('WAREHOUSE_TRANSFERS');
  }

  // Memoized calculations
  private calculateRevenue = memoize((orders: any[]) => {
    return (orders ?? []).reduce((sum, element) => sum + (element?.totalAmount ?? 0), 0);
  });

  private categorizeProducts = memoize((products: any[]) => {
    return {
      outOfStock: products.filter(p => p.inventoryStatus === 'OUTOFSTOCK'),
      lowStock: products.filter(p => p.inventoryStatus === 'LOWSTOCK')
    };
  });

  private calculateRevenueMetrics() {
    this.revenue = this.calculateRevenue(this.orders);
    this.calculateYesterdayRevenue();
    this.calculateRevenueDifferencePercentage();
  }

  private updateProductStatus() {
    const categorized = this.categorizeProducts(this.products);
    this.outOfStockProducts = categorized.outOfStock;
    this.lowStockProducts = categorized.lowStock;
  }


  // ==================== SERVICE METHODS WITH CACHING ====================

  getOrders() {
    const cacheKey = 'orders';
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      this.markOnboardingSignal('orders', (this.totalOrders || 0) > 0);
      return of(cached);
    }

    return this.orderService.getOrdersPaginated(0, 20, '', 'orderDate', 'DESC').pipe(
      map((res: any) => {
        // Store total orders count
        if (res?.totalOrders !== undefined) {
          this.totalOrders = res.totalOrders;
        } else if (res?.page?.totalElements !== undefined) {
          this.totalOrders = res.page.totalElements;
        } else if (res?.totalElements !== undefined) {
          this.totalOrders = res.totalElements;
        }

        const rows = res?.content ?? res?.page?.content ?? [];
        // Trust the count when the backend sent one; otherwise fall back to the rows we got.
        this.markOnboardingSignal('orders', (this.totalOrders || 0) > 0 || rows.length > 0);

        // Return orders array
        return rows;
      }),
      catchError(() => { this.onboardingSignals.orders = 'unknown'; return of([]); })
    );
  }

  getTodayOrders() {
    const cacheKey = 'today-orders';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    return this.orderService.getTodayOrders().pipe(
      timeout(8000), // 8 second timeout
      catchError((error) => {
        console.error('Error loading today orders:', error);
        return of([]);
      })
    );
  }

  getTop5Products() {
    const cacheKey = 'top5-products';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    return this.orderService.get5TopProducts().pipe(
      catchError(() => of([]))
    );
  }

  getTotalOrderedProducts() {
    return this.orderService.getTotalOrderedProducts().pipe(
      catchError(() => of(0))
    );
  }

  getRecentOrderedProducts() {
    const cacheKey = 'recent-ordered-products';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    return this.orderService.getRecentOrders().pipe(
      catchError(() => of([]))
    );
  }

  loadOrdersMonthlyStatistics() {
    const cacheKey = 'orders-monthly-stats';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    return this.orderService.getMonthlyOrders().pipe(
      catchError(() => of([]))
    );
  }

  loadPurchasesMonthlyStatistics() {
    const cacheKey = 'purchases-monthly-stats';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    return this.purchaseService.getMonthlyOrders().pipe(
      catchError(() => of([]))
    );
  }

  loadExpensesMonthlyStatistics() {
    const cacheKey = 'expenses-monthly-stats';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    return this.expenseService.getMonthlyOrders().pipe(
      catchError(() => of([]))
    );
  }

  getProducts() {
    const cacheKey = 'products';
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      this.markOnboardingSignal('products', (this.totalProducts || 0) > 0);
      return of(cached);
    }

    return this.productService.getProductsPaginated(0, 20, '', 'creationDate', 'DESC').pipe(
      map((res: any) => {
        this.totalProducts = res?.totalProducts ?? 0;
        this.markOnboardingSignal('products', this.totalProducts > 0);
        return res?.page?.content ?? [];
      }),
      // An empty list here is a *failure*, not an empty catalogue — say so, so onboarding stays quiet.
      catchError(() => { this.onboardingSignals.products = 'unknown'; return of([]); })
    );
  }

  getProductsOfLastWeek() {
    const cacheKey = 'last-week-products';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    return this.productService.getProductsOfLastWeek().pipe(
      catchError(() => of([]))
    );
  }

  getCustomers() {
    const cacheKey = 'customers';
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      this.markOnboardingSignal('customers', Array.isArray(cached) && cached.length > 0);
      return of(cached);
    }

    return this.customerService.getCustomers().pipe(
      map((rows: any) => {
        this.markOnboardingSignal('customers', Array.isArray(rows) && rows.length > 0);
        return rows;
      }),
      catchError(() => { this.onboardingSignals.customers = 'unknown'; return of([]); })
    );
  }

  getTodayCustomers() {
    const cacheKey = 'today-customers';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    return this.customerService.getTodayCustomers().pipe(
      timeout(8000), // 8 second timeout
      catchError((error) => {
        console.error('Error loading today customers:', error);
        return of([]);
      })
    );
  }


  // ==================== BUSINESS LOGIC METHODS ====================

  calculateYesterdayRevenue() {
    const startOfYesterday = new Date();
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date();
    endOfYesterday.setDate(endOfYesterday.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);

    this.yesterdayRevenue = this.orders
      .filter(order => {
        const creationDate = new Date(order.creationDate);
        return creationDate >= startOfYesterday && creationDate <= endOfYesterday;
      })
      .reduce((sum, order) => sum + order.totalAmount, 0);
  }

  calculateRevenueDifferencePercentage() {
    if (this.yesterdayRevenue === 0) {
      this.revenueDifferencePercentage = this.todayRevenue > 0 ? 100 : 0;
    } else {
      this.revenueDifferencePercentage = ((this.todayRevenue - this.yesterdayRevenue) / this.yesterdayRevenue) * 100;
    }
  }

  categorizeOrdersByStatus() {
    this.canceledOrders = this.todayOrders.filter(order => order.orderStatus === 'Canceled');
    this.deliveredOrders = this.todayOrders.filter(order => order.orderStatus === 'Delivered');
  }

  calculatePercentages(productQuantityMap: Map<number, number>): void {
    if (this.totalOrderedProducts > 0 && this.top5Products && this.top5Products.length > 0) {
      this.productPercentages = this.top5Products.map(product => {
        const quantity = productQuantityMap.get(product.productId) || 0;
        const percentage = (quantity / this.totalOrderedProducts) * 100;
        return { product, percentage: Math.round(percentage * 100) / 100 };
      });
    } else {
      // Reset productPercentages if conditions aren't met
      this.productPercentages = [];
    }
  }

  loadOrders(): void {
    this.totalOrderedProducts = 0;
    const productQuantityMap: Map<number, number> = new Map();

    this.orders.forEach(order => {
      order.orderItems.forEach(orderItem => {
        this.totalOrderedProducts += orderItem.quantity;
        const productId = orderItem.product.productId;
        const quantity = productQuantityMap.get(productId) || 0;
        productQuantityMap.set(productId, quantity + orderItem.quantity);
      });
    });

    this.calculatePercentages(productQuantityMap);
  }

  updateWarehouseProductCounts() {
    this.warehouseProductCounts = {};
    this.products.forEach(product => {
      if (product.warehouse && product.warehouse.name) {
        const warehouseName = product.warehouse.name;
        this.warehouseProductCounts[warehouseName] = (this.warehouseProductCounts[warehouseName] || 0) + 1;
      }
    });
  }

  getProductSalesForMonth(productId: number, year: number, month: number): number {
    let totalSales = 0;
    this.orders.forEach(order => {
      const orderDate = new Date(order.creationDate);
      if (orderDate.getFullYear() === year && orderDate.getMonth() === month) {
        order.orderItems.forEach(orderItem => {
          if (orderItem.product.productId === productId) {
            totalSales += orderItem.quantity;
          }
        });
      }
    });
    return totalSales;
  }

  // ==================== CHART METHODS ====================

  // Removed initChartsLazily() - charts now initialize directly after data loads
  // This prevents race conditions and IntersectionObserver issues

  async initChart() {
    // Guard: Don't initialize if data is not ready or already initialized
    if (this.chartsInitialized && this.chartData && this.chartDataReady) {
      return; // Already initialized
    }
    
    // Strict check: ensure all required data exists and is valid
    if (!this.ordersStatistics || !Array.isArray(this.ordersStatistics) ||
        !this.purchasesStatistics || !Array.isArray(this.purchasesStatistics) ||
        !this.expensesStatistics || !Array.isArray(this.expensesStatistics)) {
      console.warn('Chart data not ready, skipping initialization', {
        ordersStats: !!this.ordersStatistics,
        purchasesStats: !!this.purchasesStatistics,
        expensesStats: !!this.expensesStatistics
      });
      // Set empty data to prevent hanging
      this.chartData = { labels: [], datasets: [] };
      this.chartOptions = { responsive: true, maintainAspectRatio: false };
      this.chartDataReady = true;
      return;
    }
    
    // Initialize chart data directly but in a non-blocking way
    // Use setTimeout to defer to next event loop cycle
    return new Promise<void>((resolve) => {
      // Use a small delay to prevent blocking
      setTimeout(() => {
        this.initializeChartData().then(() => resolve()).catch(() => resolve());
      }, 100);
    });
  }
  
  private async initPieChart(): Promise<void> {
    // Pie chart data is initialized in initChart() method
    // This method exists for consistency and future extensibility
    if (this.pieDataReady && this.pieData) {
      return; // Already initialized
    }
    
    // Pie chart initialization happens in initChart() when warehouse data is processed
    // This is a placeholder for future separate initialization if needed
    return Promise.resolve();
  }
  
  private async initializeChartData(): Promise<void> {

    try {
      // Use firstValueFrom with timeout to prevent hanging
      const translations = await firstValueFrom(
        this.translate.get([
          'orders_menu_title', 'purchases_menu_title', 'expenses_menu_title'
        ]).pipe(
          timeout(5000),
          catchError(err => {
            console.error('Error loading chart translations:', err);
            return of({
              'orders_menu_title': 'Orders',
              'purchases_menu_title': 'Purchases',
              'expenses_menu_title': 'Expenses'
            });
          })
        )
      );

      const { textColor, textColorSecondary, surfaceBorder } = getChartThemeColors();

      const colors = getBrandCssColors();

      // Generate labels for the last 12 months
      const now = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleString('default', { month: 'short' });
        months.push(monthName);
      }

      // Map orders, purchases, and expenses statistics to the last 12 months
      const mapDataToLast12Months = (statistics) => {
        const monthlyData = new Array(12).fill(0); // Initialize array with 12 zeros

        if (!statistics || !Array.isArray(statistics)) {
          return monthlyData;
        }

        statistics.forEach(item => {
          const year = item[0]; // Year from the data
          const month = item[1] - 1; // Month from the data (convert to 0-based index)
          const totalAmount = item[2]; // Total amount for the month

          // Calculate how far back this month is from the current month
          const diffMonths = (now.getFullYear() - year) * 12 + (now.getMonth() - month);

          // Ensure the month is within the last 12 months
          if (diffMonths >= 0 && diffMonths < 12) {
            monthlyData[11 - diffMonths] = totalAmount; // Reverse the order
          }
        });

        return monthlyData;
      };

      // Ensure data arrays are filled for the last 12 months
      const ordersData = mapDataToLast12Months(this.ordersStatistics);
      const purchasesData = mapDataToLast12Months(this.purchasesStatistics);
      const expensesData = mapDataToLast12Months(this.expensesStatistics);

      // Prepare datasets for the top 5 products
      const datasets = (this.top5Products || []).map((product: any, index: number) => {
        // Check for both productId and id properties
        const productId = product?.productId || product?.id;
        if (!product || !productId) {
          console.warn('Invalid product in top5Products:', product);
          return null;
        }
        
        const salesData = []; // Initialize sales data array for 12 months
        let totalSales = 0;
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const year = date.getFullYear();
          const month = date.getMonth();
          const sales = this.getProductSalesForMonth(productId, year, month);
          salesData.push(sales);
          totalSales += sales;
        }

        const color = colors[index % colors.length]; // Rotate through predefined colors

        const fullName = product.name || `Product ${index + 1}`;
        return {
          label: fullName,
          _fullLabel: fullName,
          data: salesData,
          fill: false,
          backgroundColor: color,
          borderColor: color,
          tension: .4
        };
      }).filter(dataset => dataset !== null); // Filter out null datasets
      
      console.log('Datasets created:', datasets.length, 'Total sales across all products:', 
        datasets.reduce((sum, ds) => sum + ds.data.reduce((a: number, b: number) => a + b, 0), 0));

      // Set chart data - always create datasets if we have products, even if sales are zero
      console.log('Chart initialization - months:', months.length, 'datasets:', datasets.length, 'top5Products:', this.top5Products?.length);
      console.log('Orders available for chart:', this.orders?.length);
      
      // If we have top5Products but datasets are empty (all filtered out), recreate them
      if (datasets.length === 0 && this.top5Products && this.top5Products.length > 0) {
        console.log('Recreating datasets for top5Products - products exist but datasets were filtered');
        const validProducts = this.top5Products.filter((p: any) => p && (p.productId || p.id));
        validProducts.forEach((product: any, index: number) => {
          const productId = product.productId || product.id;
          const salesData = [];
          for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = date.getFullYear();
            const month = date.getMonth();
            const sales = this.getProductSalesForMonth(productId, year, month);
            salesData.push(sales);
          }
          const color = colors[index % colors.length];
          const fullName = product.name || `Product ${index + 1}`;
          datasets.push({
            label: fullName,
            _fullLabel: fullName,
            data: salesData,
            fill: false,
            backgroundColor: color,
            borderColor: color,
            tension: .4
          });
        });
        console.log('Recreated datasets count:', datasets.length);
      }
      
      // Always set chart data if we have months - create datasets even if empty
      if (months.length > 0) {
        // If still no datasets but we have products, create them with zero sales
        if (datasets.length === 0 && this.top5Products && this.top5Products.length > 0) {
          console.log('Creating datasets with zero sales for products');
          const validProducts = this.top5Products.filter((p: any) => p && (p.productId || p.id));
          validProducts.forEach((product: any, index: number) => {
            const salesData = new Array(12).fill(0);
            const color = colors[index % colors.length];
            const fullName = product.name || `Product ${index + 1}`;
            datasets.push({
              label: fullName,
              _fullLabel: fullName,
              data: salesData,
              fill: false,
              backgroundColor: color,
              borderColor: color,
              tension: .4
            });
          });
        }
        
        // Set chart data if we have datasets OR if we have months (even with empty datasets)
        this.chartData = {
          labels: months,
          datasets: datasets
        };
        
        console.log('Chart data set:', {
          labelsCount: this.chartData.labels.length,
          datasetsCount: this.chartData.datasets.length,
          top5ProductsCount: this.top5Products?.length,
          sampleData: datasets[0]?.data?.slice(0, 3)
        });

        this.chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { top: 4, right: 8, bottom: 4, left: 4 },
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              enabled: true,
              callbacks: {
                label: (context: { dataset: { _fullLabel?: string; label?: string }; parsed: { y: number } }) => {
                  const fullName = context.dataset._fullLabel || context.dataset.label || '';
                  const value = context.parsed?.y ?? 0;
                  return `${fullName}: ${value}`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: textColorSecondary,
                font: {
                  size: 11
                }
              },
              grid: {
                color: surfaceBorder,
                drawBorder: false
              }
            },
            y: {
              ticks: {
                color: textColorSecondary,
                font: {
                  size: 11
                }
              },
              grid: {
                color: surfaceBorder,
                drawBorder: false
              },
              beginAtZero: true // Always start at zero to show products even with zero sales
            }
          }
        };
      } else {
        // No months data
        console.warn('No months data available');
        this.chartData = { labels: [], datasets: [] };
        this.chartOptions = { responsive: true, maintainAspectRatio: false };
      }

      // Only create pie chart if we have warehouse data
      const warehouseNames = Object.keys(this.warehouseProductCounts);
      console.log('Pie chart - warehouse names:', warehouseNames.length, 'products:', this.products?.length);
      
      if (warehouseNames.length > 0) {
        const warehouseLabels = warehouseNames.map(name => name);
        const warehouseData = warehouseNames.map(name => this.warehouseProductCounts[name]);

        this.pieData = {
          labels: warehouseLabels,
          datasets: [
            {
              data: warehouseData,
              backgroundColor: getBrandCssColors(),
              hoverBackgroundColor: getBrandCssHoverColors()
            }]
        };
        
        this.pieOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
                color: textColor,
                padding: 15,
                font: {
                  size: 12
                }
              }
            },
            tooltip: {
              enabled: true
            }
          }
        };
        
        // NOTE: pieChartRenderReady will be set separately after a delay to prevent blocking
        this.pieDataReady = true;
        console.log('Pie chart data set successfully:', {
          labelsCount: this.pieData.labels.length,
          dataCount: this.pieData.datasets[0].data.length
        });
      } else {
        // Set empty pie data if no warehouses
        this.pieData = {
          labels: [],
          datasets: [{
            data: [],
            backgroundColor: [],
            hoverBackgroundColor: []
          }]
        };
        this.pieOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        };
        // NOTE: pieChartRenderReady will be set separately after a delay to prevent blocking
        this.pieDataReady = true; // Mark as ready even if empty
        console.warn('No warehouse data available for pie chart');
      }
      
      // Pie options are set in the if/else blocks above, no need to set again here

      // Ensure data arrays are filled for the last 12 months

      console.log(ordersData);
      console.log(purchasesData);
      console.log(expensesData);

      this.barData = {
        labels: months,
        datasets: [
          {
            label: translations['purchases_menu_title'],
            backgroundColor: BRAND_COLORS.saas,
            borderColor: BRAND_COLORS.saasHover,
            data: purchasesData,
          },
          {
            label: translations['expenses_menu_title'],
            backgroundColor: BRAND_COLORS.success,
            borderColor: BRAND_COLORS.successHover,
            data: expensesData,
          },
          {
            label: translations['orders_menu_title'],
            backgroundColor: BRAND_COLORS.premium,
            borderColor: BRAND_COLORS.premiumHover,
            data: ordersData,
          }
        ]
      };

      const barTheme = getChartThemeColors();
      this.barOptions = {
        plugins: {
          legend: {
            labels: {
              color: barTheme.textColor,
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: barTheme.textColorSecondary,
            },
            grid: {
              color: barTheme.surfaceBorder,
              drawBorder: false,
            }
          },
          y: {
            ticks: {
              color: barTheme.textColorSecondary,
            },
            grid: {
              color: barTheme.surfaceBorder,
              drawBorder: false,
            }
          }
        }
      };

      // Mark chart data as ready only after everything is set
      // NOTE: chartRenderReady will be set separately after a delay to prevent blocking
      this.chartDataReady = true;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error initializing charts:', error);
      // Set empty chart data to prevent hanging
      this.chartData = { labels: [], datasets: [] };
      this.chartOptions = {
        responsive: true,
        maintainAspectRatio: false
      };
      this.chartDataReady = true; // Still mark as ready so spinner doesn't show forever
      this.cdr.markForCheck();
    }
  }

  // ==================== NUMBER FORMATTING HELPERS ====================

  /**
   * Formats a number with abbreviation for large values (K, M, B)
   * @param value The number to format
   * @param decimals Number of decimal places (default: 1)
   * @returns Formatted string (e.g., "1.2K", "1.5M", "2.3B")
   */
  formatLargeNumber(value: number | null | undefined, decimals: number = 1): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }

    const num = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (num >= 1000000000) {
      return sign + (num / 1000000000).toFixed(decimals) + 'B';
    } else if (num >= 1000000) {
      return sign + (num / 1000000).toFixed(decimals) + 'M';
    } else if (num >= 1000) {
      return sign + (num / 1000).toFixed(decimals) + 'K';
    } else {
      return sign + num.toLocaleString('en-US', { maximumFractionDigits: decimals });
    }
  }

  /**
   * Formats a number with thousand separators
   * @param value The number to format
   * @returns Formatted string with commas (e.g., "1,234,567")
   */
  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }
    return value.toLocaleString('en-US');
  }

  /**
   * Gets the appropriate CSS class for number display based on value size
   * @param value The number value
   * @returns CSS class name for responsive font sizing
   */
  getNumberSizeClass(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) {
      return 'stat-number-small';
    }
    const num = Math.abs(value);
    if (num >= 1000000) {
      return 'stat-number-large';
    } else if (num >= 1000) {
      return 'stat-number-medium';
    }
    return 'stat-number-small';
  }

  hideGettingStartedCard() {
    this.showGettingStartedCard = false;
    const userPreferenceKey = `dashboard_showGettingStarted_${this.currentUsername}`;
    localStorage.setItem(userPreferenceKey, 'false');
  }

  showGettingStartedCardAgain() {
    this.showGettingStartedCard = true;
    const userPreferenceKey = `dashboard_showGettingStarted_${this.currentUsername}`;
    localStorage.setItem(userPreferenceKey, 'true');
  }

  shouldShowGettingStartedCard(): boolean {
    if (!this.showGettingStartedCard || this.setupConfirmedComplete) {
      return false;
    }
    return this.isSetupIncomplete;
  }

  /** The "bring the guide back" button — same certainty rules as the banner it restores. */
  shouldOfferGettingStartedAgain(): boolean {
    return !this.showGettingStartedCard && !this.setupConfirmedComplete && this.isSetupIncomplete;
  }

  /** Records what a source found, without ever downgrading a 'present' back to 'absent'. */
  private markOnboardingSignal(source: 'products' | 'orders' | 'customers', present: boolean): void {
    this.onboardingSignals[source] = present ? 'present' : 'absent';
  }

  /**
   * The sources the current role's onboarding actually depends on. Warehouse-only roles can't read
   * orders or customers (403), and their card only offers the "create product" step, so judging them
   * on products alone is both correct and the only thing they can act on.
   */
  private get requiredOnboardingSignals(): OnboardingSignal[] {
    const signals = this.onboardingSignals;
    return (this.isAdmin || this.isVendor)
      ? [signals.products, signals.orders, signals.customers]
      : [signals.products];
  }

  /**
   * Whether the initial setup still looks incomplete, used to decide if onboarding should show.
   *
   * Deliberately conservative: it answers "do we *know* this tenant is still empty?", not "does it
   * look empty right now". Anything less than a complete, successful picture keeps the banner
   * hidden — a moment of silence costs nothing, whereas a banner that flashes during load or nags a
   * live customer because one request 403'd undermines trust in the whole dashboard.
   */
  get isSetupIncomplete(): boolean {
    const required = this.requiredOnboardingSignals;

    // Still loading, or a source failed and we cannot honestly judge — stay quiet either way.
    if (required.some((signal) => signal === 'pending' || signal === 'unknown')) {
      return false;
    }

    if (required.every((signal) => signal === 'present')) {
      // Fully set up: latch it so a later cache miss or failed refresh can't resurrect the banner.
      this.setupConfirmedComplete = true;
      return false;
    }

    return true;
  }

  // Quick Actions Navigation Methods
  /**
   * Quick actions are shortcuts to *doing the thing*, not to the screen it lives on. Each target
   * list page opens its create dialog when handed the matching `new*` query param (the same
   * convention NadiPilot uses to hand off a confirmed proposal), so these land the user in the
   * form. The permission check stays on the target's openNew() — a user without the right can
   * still reach the list, they just don't get the dialog.
   */
  navigateToNewOrder() {
    this.router.navigate(['/sales/orders'], { queryParams: { newOrder: 1 } });
  }

  navigateToNewProduct() {
    this.router.navigate(['/inventory/products'], { queryParams: { newProduct: 1 } });
  }

  navigateToNewCustomer() {
    this.router.navigate(['/sales/customers'], { queryParams: { newCustomer: 1 } });
  }

  openCustomerDetails(customerId?: number): void {
    const id = Number(customerId);
    if (!id || Number.isNaN(id)) {
      return;
    }
    this.router.navigate(['/sales/customers', id]);
  }

  navigateToNewSupplier() {
    this.router.navigate(['/purchases/suppliers'], { queryParams: { newSupplier: 1 } });
  }

  navigateToNewPurchase() {
    this.router.navigate(['/purchases/purchases'], { queryParams: { newPurchase: 1 } });
  }

  navigateToCustomerPayment() {
    this.router.navigate(['/finance/payments/sales'], { queryParams: { newPayment: 1 } });
  }

  navigateToSupplierPayment() {
    this.router.navigate(['/finance/payments/purchase'], { queryParams: { newPayment: 1 } });
  }

  navigateToReports() {
    this.router.navigate(['/reports/sales']);
  }

  async refreshDashboard(): Promise<void> {
    this.refreshDashboardLoading = true;
    this.cache.clear(); // Clear cache to force fresh data
    this.chartsInitialized = false; // Reset chart initialization flag
    this.chartDataReady = false; // Reset chart data ready flag
    this.pieDataReady = false; // Reset pie chart data ready flag
    this.chartRenderReady = false; // Reset chart render ready flag
    this.pieChartRenderReady = false; // Reset pie chart render ready flag
    this.chartData = null; // Clear chart data to force re-initialization
    this.pieData = null;
    this.barData = null;
    this.cdr.markForCheck();
    
    try {
      // Reload all data
      await this.loadTodayMetrics();
      this.loadSecondaryData();
      this.loadAnalyticsData();
      this.loadChartOnDemand(); // re-draw charts automatically (refresh reset chartsInitialized)
      if (this.isAdmin) {
        this.loadOverview();
        this.loadAiBriefing();
        this.loadAdminMetrics();
      } else if (this.isVendor) {
        this.loadVendorMetrics();
      } else if (this.isWarehouseman) {
        this.loadWarehousemanMetrics();
      }
      
      this.refreshDashboardLoading = false;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('dashboard_refreshed') || 'Dashboard refreshed successfully',
        life: 2000
      });
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      this.refreshDashboardLoading = false;
      this.cdr.markForCheck();
    }
  }

  trackByProductId(index: number, item: any): number {
    return item.product?.productId || index;
  }

  /** Chart area uses compact height until the chart is actually rendered */
  get salesChartActive(): boolean {
    return !!(
      this.chartDataReady &&
      this.chartRenderReady &&
      this.chartData?.labels?.length > 0 &&
      this.chartData?.datasets?.length > 0
    );
  }

  get pieChartActive(): boolean {
    return !!(
      this.pieDataReady &&
      this.pieChartRenderReady &&
      this.pieData?.labels?.length > 0 &&
      this.pieData?.datasets?.length > 0
    );
  }

  // ==================== ADMIN-SPECIFIC METHODS ====================

  private loadAdminMetrics() {
    // Financial truth (revenue, margin, receivables, payables, stock value, top customers) now comes
    // from the accurate /api/dashboard/admin/overview endpoint (see loadOverview). This loader covers
    // transfer health and the MTD expense/purchase quick-stats, plus the critical-alerts feed.
    forkJoin({
      transfers: this.getPendingTransfers(),
      purchases: this.getMonthlyPurchases(),
      expenses: this.getMonthlyExpenses()
    })
      .pipe(
        timeout(15000), // 15 second timeout to prevent hanging
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading admin metrics:', error);
          return of({ transfers: [], purchases: [], expenses: [] });
        })
      )
      .subscribe((data: any) => {
        try {
          this.calculateAdminMetrics(data);
          this.buildCriticalAlerts();
          this.cdr.markForCheck();
        } catch (error) {
          console.error('Error calculating admin metrics:', error);
          // Don't break the dashboard if calculations fail
        }
      });
  }

  private getPendingTransfers() {
    if (!this.isWarehouseTransfersFeatureEnabled) {
      return of([]);
    }

    const cacheKey = 'pending-transfers';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    // Convert Promise<Observable<...>> -> Observable<...> for use with forkJoin
    return from(
      this.warehouseTransferService.searchTransfers(0, 100, undefined, undefined, 'PENDING')
    ).pipe(
      switchMap(res$ => res$),
      timeout(10000), // 10 second timeout per request
      map((res: any) => res?.content ?? []),
      catchError((error) => {
        console.error('Error loading pending transfers:', error);
        return of([]); // Return empty array on error
      })
    );
  }

  private getUnpaidPayments() {
    const cacheKey = 'unpaid-payments';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    // Get incoming payments (receivables) and outgoing payments (payables)
    return forkJoin({
      incoming: this.paymentService.getPayments('incoming', 0, 100).pipe(
        map((res: any) => res?.content ?? []),
        catchError(() => of([]))
      ),
      outgoing: this.paymentService.getPayments('outgoing', 0, 100).pipe(
        map((res: any) => res?.content ?? []),
        catchError(() => of([]))
      )
    });
  }

  private getMonthlyPurchases() {
    return this.purchaseService.getMonthlyOrders().pipe(
      catchError(() => of([]))
    );
  }

  private getMonthlyExpenses() {
    return this.expenseService.getMonthlyOrders().pipe(
      catchError(() => of([]))
    );
  }

  private calculateAdminMetrics(data: any) {
    if (!this.isWarehouseTransfersFeatureEnabled) {
      this.pendingTransfers = 0;
      this.overdueTransfers = 0;
    }

    // Calculate pending transfers
    const transfers = Array.isArray(data.transfers) ? data.transfers : (data.transfers?.content ?? []);
    this.pendingTransfers = this.isWarehouseTransfersFeatureEnabled ? transfers.length : 0;

    // Calculate overdue transfers (pending for more than 3 days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    this.overdueTransfers = this.isWarehouseTransfersFeatureEnabled ? transfers.filter((t: any) => {
      const creationDate = new Date(t.creationDate || t.transferDate);
      return creationDate < threeDaysAgo;
    }).length : 0;

    // Calculate MTD expenses and purchases
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    this.totalExpensesMTD = (data.expenses || []).reduce((sum: number, exp: any) => {
      const expDate = new Date(exp[0], exp[1] - 1, 1);
      if (expDate >= startOfMonth) {
        return sum + (exp[2] || 0);
      }
      return sum;
    }, 0);

    this.totalPurchasesMTD = (data.purchases || []).reduce((sum: number, pur: any) => {
      const purDate = new Date(pur[0], pur[1] - 1, 1);
      if (purDate >= startOfMonth) {
        return sum + (pur[2] || 0);
      }
      return sum;
    }, 0);
  }

  private buildCriticalAlerts() {
    this.criticalAlerts = [];

    // Stock signals read the authoritative whole-catalogue counts (see lowStockCount /
    // outOfStockCount). They used to be derived from the single 20-row page of products this
    // component loads — which capped every count at 20, contradicted the NadiPilot briefing, and
    // froze at whatever the sample happened to hold when this ran (the panel kept reading 18 while
    // the KPI cards next to it read 0, because a later product fetch had emptied the array).
    const outOfStock = this.outOfStockCount;
    if (outOfStock > 0) {
      this.criticalAlerts.push({
        type: 'error',
        icon: 'pi-exclamation-triangle',
        translationKey: 'alert_out_of_stock_products',
        badgeKey: 'priority_badge_stockout',
        count: outOfStock,
        action: '/inventory/products',
        severity: 'error',
        priority: 1
      });
    }

    // Low stock products
    const lowStock = this.lowStockCount;
    if (lowStock > 5) {
      this.criticalAlerts.push({
        type: 'warning',
        icon: 'pi-exclamation-circle',
        translationKey: 'alert_low_stock_products',
        badgeKey: 'priority_badge_lowstock',
        count: lowStock,
        action: '/inventory/products',
        severity: 'warn',
        priority: 2
      });
    }

    // Overdue transfers
    if (this.isWarehouseTransfersFeatureEnabled && this.overdueTransfers > 0) {
      this.criticalAlerts.push({
        type: 'warning',
        icon: 'pi-clock',
        translationKey: 'alert_overdue_transfers',
        badgeKey: 'priority_badge_transfers',
        count: this.overdueTransfers,
        action: '/inventory/warehouse-transfers',
        severity: 'warn',
        priority: 3
      });
    }

    // High unpaid receivables (point-in-time AR across all open orders, not period-scoped)
    const receivables = this.overview?.totalReceivables ?? 0;
    const overviewRevenue = this.overview?.profit?.totalRevenue ?? 0;
    if (overviewRevenue > 0 && receivables > overviewRevenue * 0.2) {
      const percentage = ((receivables / overviewRevenue) * 100).toFixed(1);
      this.criticalAlerts.push({
        type: 'info',
        icon: 'pi-dollar',
        translationKey: 'alert_high_unpaid_receivables',
        badgeKey: 'priority_badge_receivables',
        percentage: percentage,
        action: '/finance/payments',
        severity: 'info',
        priority: 4
      });
    }

    // High cancellation rate
    const cancellationRate = this.todayOrders.length > 0 
      ? (this.canceledOrders.length / this.todayOrders.length) * 100 
      : 0;
    if (cancellationRate > 10) {
      this.criticalAlerts.push({
        type: 'warning',
        icon: 'pi-ban',
        translationKey: 'alert_high_cancellation_rate',
        badgeKey: 'priority_badge_cancellations',
        percentage: cancellationRate.toFixed(1),
        action: '/sales/orders',
        severity: 'warn',
        priority: 5
      });
    }

    // Sort alerts by priority
    this.criticalAlerts.sort((a, b) => a.priority - b.priority);
  }

  loadChartOnDemand() {
    if (this.chartsInitialized && this.chartDataReady) {
      return; // Already loaded
    }
    
    if (this.chartsInitialized) {
      // Already initializing, don't start again
      return;
    }
    
    this.chartsInitialized = true; // Mark as initializing to prevent multiple calls
    
    console.log('Loading chart on demand. Current state:', {
      top5Products: this.top5Products?.length || 0,
      orders: this.orders?.length || 0,
      ordersStatistics: this.ordersStatistics?.length || 0
    });
    
    // Always load fresh data to ensure we have everything needed
    forkJoin({
      top5Products: this.getTop5Products(),
      ordersResponse: this.getOrders(), // Load orders to calculate sales
      ordersStatistics: this.loadOrdersMonthlyStatistics(),
      expensesStatistics: this.loadExpensesMonthlyStatistics(),
      purchasesStatistics: this.loadPurchasesMonthlyStatistics(),
      products: this.getProducts()
    })
      .pipe(
        takeUntil(this.destroy$),
        timeout(15000),
        catchError(error => {
          console.error('Error loading chart data:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load chart data. Please try again.',
            life: 3000
          });
          this.chartDataReady = true;
          this.chartData = { labels: [], datasets: [] };
          this.chartOptions = { responsive: true, maintainAspectRatio: false };
          this.cdr.markForCheck();
          return of({
            top5Products: [],
            ordersResponse: [],
            ordersStatistics: [],
            expensesStatistics: [],
            purchasesStatistics: [],
            products: []
          });
        })
      )
      .subscribe((data: any) => {
        // Update data
        this.top5Products = data.top5Products || [];
        
        // Update orders - handle both array and paginated response
        this.orders = Array.isArray(data.ordersResponse)
          ? data.ordersResponse
          : (data.ordersResponse?.content ?? []);
        
        this.ordersStatistics = data.ordersStatistics || [];
        this.expensesStatistics = data.expensesStatistics || [];
        this.purchasesStatistics = data.purchasesStatistics || [];
        // An empty list here is usually this forkJoin's catchError/timeout firing, not an empty
        // catalogue — overwriting good rows with it silently zeroed the stock tiles mid-session.
        if (Array.isArray(data.products) && data.products.length > 0) {
          this.products = data.products;
        }
        
        console.log('Chart data loaded:', {
          top5Products: this.top5Products.length,
          orders: this.orders.length,
          ordersStats: this.ordersStatistics.length
        });
        
        // Recalculate product percentages now that both orders and top5Products are loaded
        if (this.orders && this.orders.length > 0 && this.top5Products && this.top5Products.length > 0) {
          this.loadOrders();
        }
        
          this.updateProductStatus();
          this.updateWarehouseProductCounts();
          
          // Now initialize charts with the loaded data - use multiple setTimeout to prevent blocking
          // This pushes chart initialization to multiple event loop cycles
          setTimeout(() => {
            // Initialize line chart first
            setTimeout(() => {
              this.initChart().catch(err => {
                console.error('Error initializing line chart on demand:', err);
                this.chartData = { labels: [], datasets: [] };
                this.chartOptions = { responsive: true, maintainAspectRatio: false };
                this.chartDataReady = true;
                this.cdr.markForCheck();
              }).then(() => {
                this.chartDataReady = true;
                this.cdr.markForCheck();
                
                // Defer actual chart DOM rendering to prevent blocking
                setTimeout(() => {
                  this.chartRenderReady = true;
                  this.cdr.markForCheck();
                }, 300);
              });
            }, 100);
            
            // Initialize pie chart separately with delay
            setTimeout(() => {
              this.initPieChart().catch(err => {
                console.error('Error initializing pie chart on demand:', err);
                this.pieData = { labels: [], datasets: [] };
                this.pieOptions = { responsive: true, maintainAspectRatio: false };
                // NOTE: pieChartRenderReady will be set separately after a delay to prevent blocking
        this.pieDataReady = true;
                this.cdr.markForCheck();
              }).then(() => {
                // NOTE: pieChartRenderReady will be set separately after a delay to prevent blocking
        this.pieDataReady = true;
                this.cdr.markForCheck();
                
                // Defer actual pie chart DOM rendering to prevent blocking
                setTimeout(() => {
                  this.pieChartRenderReady = true;
                  this.cdr.markForCheck();
                }, 400);
              });
            }, 200);
          }, 100);
      });
  }

  getAdminQuickActions(): any[] {
    // Use synchronous translation or fallback to English labels
    const getLabel = (key: string, fallback: string) => {
      try {
        const translated = this.translate.instant(key);
        return translated && translated !== key ? translated : fallback;
      } catch {
        return fallback;
      }
    };

    const actions = [
      { label: getLabel('users_menu_title', 'Users'), icon: 'pi pi-user-plus', route: ['/administration/users'], tooltip: 'Manage system users' },
      { label: getLabel('products_menu_title', 'Items'), icon: 'pi pi-box', route: ['/inventory/products'], tooltip: 'Manage items' },
      { label: getLabel('orders_menu_title', 'Orders'), icon: 'pi pi-shopping-cart', route: ['/sales/orders'], tooltip: 'View all orders' },
      { label: getLabel('warehouses_menu_title', 'Warehouses'), icon: 'pi pi-database', route: ['/inventory/warehouses'], tooltip: 'Manage warehouses' },
      { label: getLabel('settings_menu_title', 'Settings'), icon: 'pi pi-cog', route: ['/administration/settings'], tooltip: 'System settings' },
      { label: getLabel('financial_docs_menu_title', 'Financial Docs'), icon: 'pi pi-file', route: ['/finance/financial-documents'], tooltip: 'Financial documents' },
      { label: getLabel('warehouse_transfers_menu_title', 'Transfers'), icon: 'pi pi-arrow-right-arrow-left', route: ['/inventory/warehouse-transfers'], tooltip: 'Warehouse transfers' },
      { label: getLabel('expenses_menu_title', 'Expenses'), icon: 'pi pi-money-bill', route: ['/finance/expenses'], tooltip: 'Manage expenses' }
    ];
    return this.isWarehouseTransfersFeatureEnabled
      ? actions
      : actions.filter(action => action.route?.[0] !== '/inventory/warehouse-transfers');
  }

  getVendorQuickActions(): any[] {
    const getLabel = (key: string, fallback: string) => {
      try {
        const translated = this.translate.instant(key);
        return translated && translated !== key ? translated : fallback;
      } catch {
        return fallback;
      }
    };

    return [
      // A "New X" action opens the form; a bare section name goes to the list. queryParams carries
      // the difference — see navigateToNewOrder() for the convention.
      { label: getLabel('add_new_order', 'New Order'), icon: 'pi pi-plus-circle', route: ['/sales/orders'], queryParams: { newOrder: 1 }, tooltip: 'Create new order' },
      { label: getLabel('orders_menu_title', 'Orders'), icon: 'pi pi-shopping-cart', route: ['/sales/orders'], tooltip: 'View all orders' },
      { label: getLabel('customers_menu_title', 'Customers'), icon: 'pi pi-users', route: ['/sales/customers'], tooltip: 'Manage customers' },
      { label: getLabel('products_menu_title', 'Items'), icon: 'pi pi-box', route: ['/inventory/products'], tooltip: 'View items' },
      // Was '/finance/sales-payments', which matches no route and fell through to /notfound.
      { label: getLabel('payments_menu_title', 'Payments'), icon: 'pi pi-credit-card', route: ['/finance/payments/sales'], tooltip: 'View payments' },
      { label: getLabel('returns_menu_title', 'Returns'), icon: 'pi pi-undo', route: ['/sales/returns'], tooltip: 'Manage returns' }
    ];
  }

  getWarehousemanQuickActions(): any[] {
    const getLabel = (key: string, fallback: string) => {
      try {
        const translated = this.translate.instant(key);
        return translated && translated !== key ? translated : fallback;
      } catch {
        return fallback;
      }
    };

    const actions = [
      { label: getLabel('warehouse_transfers_menu_title', 'Transfers'), icon: 'pi pi-arrow-right-arrow-left', route: ['/inventory/warehouse-transfers'], tooltip: 'Manage transfers' },
      { label: getLabel('new_transfer', 'New Transfer'), icon: 'pi pi-plus-circle', route: ['/inventory/warehouse-transfers'], queryParams: { newTransfer: 1 }, tooltip: 'Create new transfer' },
      { label: getLabel('products_menu_title', 'Items'), icon: 'pi pi-box', route: ['/inventory/products'], tooltip: 'View items' },
      { label: getLabel('stock_movements_menu_title', 'Stock Movements'), icon: 'pi pi-chart-line', route: ['/inventory/stock-movements'], tooltip: 'View stock movements' },
      { label: getLabel('warehouses_menu_title', 'Warehouses'), icon: 'pi pi-database', route: ['/inventory/warehouses'], tooltip: 'View warehouses' },
      // Was '/finance/purchases', which matches no route and fell through to /notfound.
      { label: getLabel('purchases_menu_title', 'Purchases'), icon: 'pi pi-shopping-bag', route: ['/purchases/purchases'], tooltip: 'View purchases' }
    ];
    return this.isWarehouseTransfersFeatureEnabled
      ? actions
      : actions.filter(action => action.route?.[0] !== '/inventory/warehouse-transfers');
  }

  // ==================== VENDOR-SPECIFIC METHODS ====================

  private loadVendorMetrics() {
    forkJoin({
      todayOrders: this.getTodayOrders(),
      unpaidOrders: this.getUnpaidOrders(),
      recentCustomers: this.getRecentCustomers()
    })
      .pipe(
        timeout(15000),
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading vendor metrics:', error);
          return of({
            todayOrders: [],
            unpaidOrders: [],
            recentCustomers: []
          });
        })
      )
      .subscribe((data: any) => {
        try {
          this.calculateVendorMetrics(data);
          this.cdr.markForCheck();
        } catch (error) {
          console.error('Error calculating vendor metrics:', error);
        }
      });
  }

  private getUnpaidOrders() {
    const cacheKey = 'unpaid-orders';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    return this.orderService.getOrdersPaginated(0, 100, '', 'orderDate', 'DESC').pipe(
      map((res: any) => {
        const orders = res?.content ?? [];
        return orders.filter((order: Order) => 
          order.paymentStatus === 'UNPAID' || order.paymentStatus === 'PARTIALLY_PAID'
        );
      }),
      catchError(() => of([]))
    );
  }

  private getRecentCustomers() {
    const cacheKey = 'recent-customers';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    return this.customerService.getCustomers().pipe(
      map((customers: Customer[]) => (customers || []).slice(0, 10)),
      catchError(() => of([]))
    );
  }

  private calculateVendorMetrics(data: any) {
    // Calculate today's sales
    this.vendorTodaySales = (data.todayOrders || []).reduce((sum: number, order: Order) => 
      sum + (order.totalAmount || 0), 0
    );

    // Calculate pending payments
    this.vendorUnpaidOrders = (data.unpaidOrders || []).length;
    this.vendorPendingPayments = (data.unpaidOrders || []).reduce((sum: number, order: Order) => 
      sum + ((order.totalAmount || 0) - (order.totalPaid || 0)), 0
    );

    // Get recent customers
    this.vendorRecentCustomers = (data.recentCustomers || []).slice(0, 5);

    // Get top selling products from today's orders
    const productSales: { [key: string]: { product: any, quantity: number, revenue: number } } = {};
    (data.todayOrders || []).forEach((order: Order) => {
      (order.orderItems || []).forEach((item: any) => {
        const productId = item.product?.productId;
        if (productId) {
          if (!productSales[productId]) {
            productSales[productId] = {
              product: item.product,
              quantity: 0,
              revenue: 0
            };
          }
          productSales[productId].quantity += item.quantity || 0;
          // price is per display unit; lineAmount converts storage qty for fractional/prepaid products.
          productSales[productId].revenue += QuantityScale.lineAmount(item.product, item.quantity || 0, item.price || 0);
        }
      });
    });

    this.vendorTopSellingProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  /** Top-selling product sold quantity in display units + unit (e.g. "0.5 kg"). */
  formatTopProductQuantity(item: any): string {
    const displayQty = displayWarehouseStockQuantity(item?.product, item?.quantity ?? 0);
    const formatted = formatLineQuantity(item?.product, displayQty);
    const unit = getLineMeasureUnit(item?.product, displayQty);
    return unit ? `${formatted} ${this.translate.instant(unit)}` : `${formatted} ${this.translate.instant('units')}`;
  }

  // ==================== WAREHOUSEMAN-SPECIFIC METHODS ====================

  private loadWarehousemanMetrics() {
    forkJoin({
      transfers: this.getPendingTransfers(),
      warehouse: this.getAssignedWarehouse()
    })
      .pipe(
        // Stock counts are asked of the backend, scoped to the assigned warehouse, once we know which
        // warehouse that is — they used to be a filter over the same 20-row product page the admin
        // tiles used, so they were capped at 20 and disagreed with the products page.
        switchMap((data: any) =>
          this.getWarehouseStockStats(data.warehouse?.warehouseId).pipe(
            map((stats: any) => ({ ...data, stats }))
          )
        ),
        timeout(15000),
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading warehouseman metrics:', error);
          return of({
            transfers: [],
            warehouse: null,
            stats: null
          });
        })
      )
      .subscribe((data: any) => {
        try {
          this.calculateWarehousemanMetrics(data);
          this.cdr.markForCheck();
        } catch (error) {
          console.error('Error calculating warehouseman metrics:', error);
        }
      });
  }

  /**
   * Warehouse-scoped stock KPIs from the backend (`/api/stock/products/stats?warehouseId=`), which
   * classifies every active product in that warehouse live from its on-hand quantity — the same rule
   * the admin overview and the NadiPilot briefing use.
   */
  private getWarehouseStockStats(warehouseId?: number) {
    if (!warehouseId) {
      return of(null);
    }
    this.productService.loadToken();
    return this.productService.getProductStats(warehouseId).pipe(
      catchError(error => {
        console.warn('Could not load warehouse stock stats', error);
        return of(null);
      })
    );
  }

  private getAssignedWarehouse() {
    // This would typically get the warehouse assigned to the current user
    // For now, return the first warehouse or null
    return from(this.warehouseService.loadToken()).pipe(
      switchMap(() => this.warehouseService.getWarehouses()),
      map((warehouses: any) => {
        if (Array.isArray(warehouses)) {
          return warehouses?.[0] || null;
        }
        const content = (warehouses as any)?.content;
        if (Array.isArray(content)) {
          return content?.[0] || null;
        }
        return warehouses?.[0] || null;
      }),
      catchError(() => of(null))
    );
  }

  private calculateWarehousemanMetrics(data: any) {
    this.assignedWarehouse = data.warehouse;

    // Whole-warehouse figures, computed backend-side. A failed stats call leaves the previous values
    // in place rather than reporting a confident zero.
    const stats = data.stats;
    if (stats) {
      this.warehouseTotalProducts = stats.totalProducts ?? 0;
      this.warehouseLowStockCount = stats.lowStockCount ?? 0;
      this.warehouseOutOfStockCount = stats.outOfStockCount ?? 0;
    }

    // Get pending transfers
    this.warehousePendingTransfers = (data.transfers || []).length;
  }

}
