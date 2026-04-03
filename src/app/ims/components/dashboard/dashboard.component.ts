import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { MenuItem, MessageService } from 'primeng/api';

import { Subject, Subscription, catchError, debounceTime, firstValueFrom, forkJoin, of, takeUntil, map, from, switchMap, timeout } from 'rxjs';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
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

  // Admin-specific metrics
  totalStockValue = 0;
  unpaidReceivables = 0;
  unpaidPayables = 0;
  pendingTransfers = 0;
  overdueTransfers = 0;
  totalExpensesMTD = 0;
  totalPurchasesMTD = 0;
  grossMarginPercentage = 0;
  topCustomersByRevenue: any[] = [];
  criticalAlerts: any[] = [];
  isWarehouseman = false;

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
  dataLoaded: boolean = false; // Track if data has been loaded to prevent flickering

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
    private router: Router
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
          summary: 'Dashboard',
          detail: 'Dashboard loaded. Some data may still be loading.',
          life: 3000
        });
      }
    }, 5000);

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
      this.loadAdminMetrics();
    } else if (this.isVendor) {
      this.loadVendorMetrics();
    } else if (this.isWarehouseman) {
      this.loadWarehousemanMetrics();
    }
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
    if (cached) return of(cached);

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
        
        // Return orders array
        return res?.content ?? res?.page?.content ?? [];
      }),
      catchError(() => of([]))
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
    if (cached) return of(cached);

    return this.productService.getProductsPaginated(0, 20, '', 'creationDate', 'DESC').pipe(
      map((res: any) => {
        this.totalProducts = res?.totalProducts ?? 0;
        return res?.page?.content ?? [];
      }),
      catchError(() => of([]))
    );
  }

  getAllProductsForStockValue() {
    const cacheKey = 'all-products-stock';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    // Load a large number of products for accurate stock value calculation
    // Using a large page size (1000) to get most/all products
    return this.productService.getProductsPaginated(0, 1000, '', 'creationDate', 'DESC').pipe(
      map((res: any) => {
        return res?.page?.content ?? [];
      }),
      catchError(() => of([]))
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
    if (cached) return of(cached);

    return this.customerService.getCustomers().pipe(
      catchError(() => of([]))
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

      const documentStyle = getComputedStyle(document.documentElement);
      const textColor = documentStyle.getPropertyValue('--text-color');
      const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
      const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

      const colors = [
        documentStyle.getPropertyValue('--indigo-500'),
        documentStyle.getPropertyValue('--purple-500'),
        documentStyle.getPropertyValue('--teal-500'),
        documentStyle.getPropertyValue('--orange-500'),
        documentStyle.getPropertyValue('--pink-500'),
      ];

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

        return {
          label: product.name || `Product ${index + 1}`,
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
          datasets.push({
            label: product.name || `Product ${index + 1}`,
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
            datasets.push({
              label: product.name || `Product ${index + 1}`,
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
          plugins: {
            legend: {
              position: 'top',
              labels: {
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
              backgroundColor: [
                documentStyle.getPropertyValue('--indigo-500'),
                documentStyle.getPropertyValue('--purple-500'),
                documentStyle.getPropertyValue('--teal-500'),
                documentStyle.getPropertyValue('--orange-500'),
                documentStyle.getPropertyValue('--pink-500')
              ],
              hoverBackgroundColor: [
                documentStyle.getPropertyValue('--indigo-400'),
                documentStyle.getPropertyValue('--purple-400'),
                documentStyle.getPropertyValue('--teal-400'),
                documentStyle.getPropertyValue('--orange-400'),
                documentStyle.getPropertyValue('--pink-400')
              ]
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
            backgroundColor: '#42A5F5',
            borderColor: '#1E88E5',
            data: purchasesData,
          },
          {
            label: translations['expenses_menu_title'],
            backgroundColor: '#9CCC65',
            borderColor: '#7CB342',
            data: expensesData,
          },
          {
            label: translations['orders_menu_title'],
            backgroundColor: '#FFA726',
            borderColor: '#FB8C00',
            data: ordersData,
          }
        ]
      };

      this.barOptions = {
        plugins: {
          legend: {
            labels: {
              color: '#495057'
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#495057'
            },
            grid: {
              color: '#ebedef'
            }
          },
          y: {
            ticks: {
              color: '#495057'
            },
            grid: {
              color: '#ebedef'
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
    // Only show card after data has been loaded to prevent flickering
    if (!this.dataLoaded) {
      return false;
    }
    // Show card if user hasn't dismissed it AND system is new (no orders, products, or customers)
    const isSystemNew = this.totalOrders === 0 || this.totalProducts === 0 || (this.customers && this.customers.length === 0);
    return this.showGettingStartedCard && isSystemNew;
  }

  // Quick Actions Navigation Methods
  navigateToNewOrder() {
    this.router.navigate(['/sales/orders']);
  }

  navigateToNewProduct() {
    this.router.navigate(['/inventory/products']);
  }

  navigateToNewCustomer() {
    this.router.navigate(['/sales/customers']);
  }

  navigateToNewSupplier() {
    this.router.navigate(['/purchases/suppliers']);
  }

  navigateToNewPurchase() {
    this.router.navigate(['/purchases/purchases']);
  }

  navigateToCustomerPayment() {
    this.router.navigate(['/finance/payments/sales']);
  }

  navigateToSupplierPayment() {
    this.router.navigate(['/finance/payments/purchase']);
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
      if (this.isAdmin) {
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
    forkJoin({
      transfers: this.getPendingTransfers(),
      payments: this.getUnpaidPayments(),
      purchases: this.getMonthlyPurchases(),
      expenses: this.getMonthlyExpenses(),
      allProducts: this.getAllProductsForStockValue()
    })
      .pipe(
        timeout(15000), // 15 second timeout to prevent hanging
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading admin metrics:', error);
          // Return empty data structure to prevent dashboard from breaking
          return of({
            transfers: [],
            payments: { incoming: [], outgoing: [] },
            purchases: [],
            expenses: [],
            allProducts: []
          });
        })
      )
      .subscribe((data: any) => {
        try {
          this.calculateAdminMetrics(data);
          // Calculate stock value using all products for accurate calculation
          if (data.allProducts && data.allProducts.length > 0) {
            this.calculateStockValue(data.allProducts);
          } else if (this.products && this.products.length > 0) {
            // Fallback to loaded products if all products failed to load
            this.calculateStockValue(this.products);
          }
          this.calculateUnpaidBalances(data);
          this.calculateGrossMargin();
          this.calculateTopCustomers();
          this.buildCriticalAlerts();
          this.cdr.markForCheck();
        } catch (error) {
          console.error('Error calculating admin metrics:', error);
          // Don't break the dashboard if calculations fail
        }
      });
  }

  private getPendingTransfers() {
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
    // Calculate pending transfers
    const transfers = Array.isArray(data.transfers) ? data.transfers : (data.transfers?.content ?? []);
    this.pendingTransfers = transfers.length;

    // Calculate overdue transfers (pending for more than 3 days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    this.overdueTransfers = transfers.filter((t: any) => {
      const creationDate = new Date(t.creationDate || t.transferDate);
      return creationDate < threeDaysAgo;
    }).length;

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

  private calculateStockValue(products?: Product[]) {
    const productsToCalculate = products || this.products;
    
    if (!productsToCalculate || productsToCalculate.length === 0) {
      this.totalStockValue = 0;
      return;
    }
    
    this.totalStockValue = productsToCalculate.reduce((sum, product) => {
      const quantity = product.quantityAvailable || 0;
      const cost = product.standardCost || product.buyingPrice || 0;
      const productValue = quantity * cost;
      return sum + productValue;
    }, 0);
    
    console.log('Stock value calculated:', {
      productsCount: productsToCalculate.length,
      totalStockValue: this.totalStockValue
    });
  }

  private calculateUnpaidBalances(data: any) {
    // Calculate unpaid receivables (orders with unpaid amounts)
    this.unpaidReceivables = this.orders.reduce((sum, order) => {
      const totalAmount = order.totalAmount || 0;
      const totalPaid = order.totalPaid || 0;
      const unpaid = totalAmount - totalPaid;
      return sum + (unpaid > 0 ? unpaid : 0);
    }, 0);

    // Calculate unpaid payables from purchases
    // This would require purchase data - for now, we'll estimate from orders
    // In a real scenario, you'd fetch purchases and calculate unpaid amounts
    this.unpaidPayables = 0; // Placeholder - would need purchase service data
  }

  private calculateGrossMargin() {
    if (this.revenue > 0) {
      const totalCosts = this.orders.reduce((sum, order) => {
        return sum + (order.orderItems?.reduce((itemSum: number, item: any) => {
          const cost = item.product?.standardCost || item.product?.buyingPrice || 0;
          return itemSum + (cost * (item.quantity || 0));
        }, 0) || 0);
      }, 0);
      const grossProfit = this.revenue - totalCosts;
      this.grossMarginPercentage = (grossProfit / this.revenue) * 100;
    }
  }

  private calculateTopCustomers() {
    const customerRevenue = new Map<number, { customer: Customer, revenue: number }>();
    
    this.orders.forEach(order => {
      if (order.customer?.customerId) {
        const existing = customerRevenue.get(order.customer.customerId) || { 
          customer: order.customer, 
          revenue: 0 
        };
        existing.revenue += order.totalAmount || 0;
        customerRevenue.set(order.customer.customerId, existing);
      }
    });

    this.topCustomersByRevenue = Array.from(customerRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  private buildCriticalAlerts() {
    this.criticalAlerts = [];

    // Out of stock products with pending orders
    const outOfStockWithOrders = this.outOfStockProducts.filter(product => {
      return this.orders.some(order => 
        order.orderItems?.some(item => item.product?.productId === product.productId)
      );
    });
    if (outOfStockWithOrders.length > 0) {
      this.criticalAlerts.push({
        type: 'error',
        icon: 'pi-exclamation-triangle',
        translationKey: 'alert_out_of_stock_with_orders',
        count: outOfStockWithOrders.length,
        action: '/inventory/products',
        severity: 'error',
        priority: 1
      });
    }

    // Low stock products
    if (this.lowStockProducts.length > 5) {
      this.criticalAlerts.push({
        type: 'warning',
        icon: 'pi-exclamation-circle',
        translationKey: 'alert_low_stock_products',
        count: this.lowStockProducts.length,
        action: '/inventory/products',
        severity: 'warn',
        priority: 2
      });
    }

    // Overdue transfers
    if (this.overdueTransfers > 0) {
      this.criticalAlerts.push({
        type: 'warning',
        icon: 'pi-clock',
        translationKey: 'alert_overdue_transfers',
        count: this.overdueTransfers,
        action: '/inventory/warehouse-transfers',
        severity: 'warn',
        priority: 3
      });
    }

    // High unpaid receivables
    if (this.unpaidReceivables > this.revenue * 0.2) {
      const percentage = ((this.unpaidReceivables / this.revenue) * 100).toFixed(1);
      this.criticalAlerts.push({
        type: 'info',
        icon: 'pi-dollar',
        translationKey: 'alert_high_unpaid_receivables',
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
        this.products = data.products || [];
        
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

    return [
      { label: getLabel('users_menu_title', 'Users'), icon: 'pi pi-user-plus', route: ['/administration/users'], tooltip: 'Manage system users' },
      { label: getLabel('products_menu_title', 'Products'), icon: 'pi pi-box', route: ['/inventory/products'], tooltip: 'Manage products' },
      { label: getLabel('orders_menu_title', 'Orders'), icon: 'pi pi-shopping-cart', route: ['/sales/orders'], tooltip: 'View all orders' },
      { label: getLabel('warehouses_menu_title', 'Warehouses'), icon: 'pi pi-database', route: ['/inventory/warehouses'], tooltip: 'Manage warehouses' },
      { label: getLabel('settings_menu_title', 'Settings'), icon: 'pi pi-cog', route: ['/administration/settings'], tooltip: 'System settings' },
      { label: getLabel('financial_docs_menu_title', 'Financial Docs'), icon: 'pi pi-file', route: ['/finance/financial-documents'], tooltip: 'Financial documents' },
      { label: getLabel('warehouse_transfers_menu_title', 'Transfers'), icon: 'pi pi-arrow-right-arrow-left', route: ['/inventory/warehouse-transfers'], tooltip: 'Warehouse transfers' },
      { label: getLabel('expenses_menu_title', 'Expenses'), icon: 'pi pi-money-bill', route: ['/finance/expenses'], tooltip: 'Manage expenses' }
    ];
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
      { label: getLabel('add_new_order', 'New Order'), icon: 'pi pi-plus-circle', route: ['/sales/orders'], tooltip: 'Create new order' },
      { label: getLabel('orders_menu_title', 'Orders'), icon: 'pi pi-shopping-cart', route: ['/sales/orders'], tooltip: 'View all orders' },
      { label: getLabel('customers_menu_title', 'Customers'), icon: 'pi pi-users', route: ['/sales/customers'], tooltip: 'Manage customers' },
      { label: getLabel('products_menu_title', 'Products'), icon: 'pi pi-box', route: ['/inventory/products'], tooltip: 'View products' },
      { label: getLabel('payments_menu_title', 'Payments'), icon: 'pi pi-credit-card', route: ['/finance/sales-payments'], tooltip: 'View payments' },
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

    return [
      { label: getLabel('warehouse_transfers_menu_title', 'Transfers'), icon: 'pi pi-arrow-right-arrow-left', route: ['/inventory/warehouse-transfers'], tooltip: 'Manage transfers' },
      { label: getLabel('new_transfer', 'New Transfer'), icon: 'pi pi-plus-circle', route: ['/inventory/warehouse-transfers'], tooltip: 'Create new transfer' },
      { label: getLabel('products_menu_title', 'Products'), icon: 'pi pi-box', route: ['/inventory/products'], tooltip: 'View products' },
      { label: getLabel('stock_movements_menu_title', 'Stock Movements'), icon: 'pi pi-chart-line', route: ['/inventory/stock-movements'], tooltip: 'View stock movements' },
      { label: getLabel('warehouses_menu_title', 'Warehouses'), icon: 'pi pi-database', route: ['/inventory/warehouses'], tooltip: 'View warehouses' },
      { label: getLabel('purchases_menu_title', 'Purchases'), icon: 'pi pi-shopping-bag', route: ['/finance/purchases'], tooltip: 'View purchases' }
    ];
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
          productSales[productId].revenue += (item.price || 0) * (item.quantity || 0);
        }
      });
    });

    this.vendorTopSellingProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  // ==================== WAREHOUSEMAN-SPECIFIC METHODS ====================

  private loadWarehousemanMetrics() {
    forkJoin({
      products: this.getProducts(),
      transfers: this.getPendingTransfers(),
      warehouse: this.getAssignedWarehouse()
    })
      .pipe(
        timeout(15000),
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading warehouseman metrics:', error);
          return of({
            products: [],
            transfers: [],
            warehouse: null
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
    const products = data.products || [];
    
    // Filter products by assigned warehouse if available
    let warehouseProducts = products;
    if (data.warehouse) {
      warehouseProducts = products.filter((p: Product) => 
        p.warehouse?.warehouseId === data.warehouse.warehouseId
      );
    }

    this.assignedWarehouse = data.warehouse;
    this.warehouseTotalProducts = warehouseProducts.length;
    
    // Calculate stock status
    this.warehouseLowStockCount = warehouseProducts.filter((p: Product) => 
      p.inventoryStatus === 'LOWSTOCK'
    ).length;
    
    this.warehouseOutOfStockCount = warehouseProducts.filter((p: Product) => 
      p.inventoryStatus === 'OUTOFSTOCK'
    ).length;

    // Get pending transfers
    this.warehousePendingTransfers = (data.transfers || []).length;
  }

}
