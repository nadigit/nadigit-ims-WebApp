import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { MenuItem, MessageService, SelectItem } from 'primeng/api';

import { Subject, Subscription, catchError, debounceTime, firstValueFrom, forkJoin, of, takeUntil, map } from 'rxjs';
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
import { AnalysisService, ProfitAnalysis, ProfitPeriod, Shop } from 'src/app/services/analysis.service';
import { Order } from 'src/app/models/order';
import { Product } from 'src/app/models/product';
import { Customer } from 'src/app/models/customer';


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
  profitLoading = false;
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
  shops: Shop[] = [];
  todayCustomers?: Customer[] = [];
  totalProducts = 0;


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

  // Filtering
  profitPeriods: any[] = [];
  selectedPeriod: ProfitPeriod = ProfitPeriod.MONTH;
  selectedShop: Shop | null = null;
  shopOptions: SelectItem[] = [];


  // Charts
  chartData: any;
  chartOptions: any;
  pieData: any;
  pieOptions: any;
  barData: any;
  barOptions: any;
  profitChartData: any;
  profitChartOptions: any;

  // Product status
  outOfStockProducts: any[] = [];
  lowStockProducts: any[] = [];
  canceledOrders: any[] = [];
  deliveredOrders: any[] = [];

  // Warehouse
  warehouseProductCounts: { [key: string]: number } = {};


  // Profit analysis
  profitData: any;
  error: string | null = null;
  currency = 'USD';
  userRoles: string[] = [];
  productPercentages: any[] = [];

  // Dashboard refresh
  refreshDashboardLoading: boolean = false;

  // Private properties for performance optimization
  private destroy$ = new Subject<void>();
  private filterChange$ = new Subject<void>();
  private cache = new Map<string, { data: any, timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private subscriptions: any[] = [];
  subscription!: Subscription;



  // items!: MenuItem[];





  constructor(private orderService: OrderService,
    private productService: ProductService,
    private purchaseService: PurchaseService,
    private analysisService: AnalysisService,
    private expenseService: ExpenseService,
    private customerService: CustomerService,
    public layoutService: LayoutService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    public keycloakService: KeycloakService,
    public messageService: MessageService,
    private cdr: ChangeDetectorRef
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

    try {
      // Load critical data first for initial render
      await this.loadCriticalData();

      // Load secondary data after initial render
      this.loadSecondaryData();

      // Setup reactive subscriptions
      this.setupSubscriptions();

      // Load heavy components with delay
      setTimeout(() => {
        this.loadHeavyComponents();
        this.isLoading = false;
      }, 500);

    } catch (error) {
      console.error('Error initializing dashboard:', error);
      this.isLoading = false;
      this.cdr.markForCheck();
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
    await this.setUserRoles();
    await this.loadUserPreferences();
    await this.loadTodayMetrics();
    await this.loadTranslations();
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
      const [todayOrders, todayCustomers] = await Promise.all([
        this.getTodayOrders().toPromise() as Promise<Order[] | undefined>,
        this.getTodayCustomers().toPromise() as Promise<Customer[] | undefined>
      ]);

      this.todayOrders = todayOrders || [];
      this.todayCustomers = todayCustomers || [];
      this.todayRevenue = this.calculateRevenue(this.todayOrders);
      this.categorizeOrdersByStatus();

    } catch (error) {
      console.error('Error loading today metrics:', error);
    }
  }

  private async loadTranslations() {
    try {
      const translations = await this.translate
        .getTranslation(this.translateService.getPreferredLanguage())
        .toPromise();

      this.profitPeriods = [
        { label: translations['Today'], value: 'TODAY' },
        { label: translations['Yesterday'], value: 'YESTERDAY' },
        { label: translations['This Week'], value: 'WEEK' },
        { label: translations['This Month'], value: 'MONTH' },
        { label: translations['Last 6 Months'], value: 'LAST_SIX_MONTHS' },
        { label: translations['This Year'], value: 'YEAR' },
        { label: translations['Last 12 Months'], value: 'LAST_12_MONTHS' }
      ];

    } catch (error) {
      console.error('Error loading translations:', error);
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
        this.orders = Array.isArray(data.ordersResponse)
          ? data.ordersResponse
          : (data.ordersResponse as any)?.content ?? [];

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
    this.loadAnalyticsData();
    this.loadShops();
    this.initChartsLazily();
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

        this.updateProductStatus();
        this.updateWarehouseProductCounts();
        this.cdr.markForCheck();
      });
  }

  // ==================== REACTIVE SUBSCRIPTIONS ====================

  private setupSubscriptions() {
    // Debounced filter changes
    const filterSub = this.filterChange$
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadProfitData();
      });

    this.subscriptions.push(filterSub);
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
      map((res: any) => res?.content ?? []),   // ← This makes sure you ALWAYS return an array
      catchError(() => of([]))
    );
  }

  getTodayOrders() {
    const cacheKey = 'today-orders';
    const cached = this.getCachedData(cacheKey);
    if (cached) return of(cached);

    return this.orderService.getTodayOrders().pipe(
      catchError(() => of([]))
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
      catchError(() => of([]))
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
    if (this.totalOrderedProducts > 0 && this.top5Products.length > 0) {
      this.productPercentages = this.top5Products.map(product => {
        const quantity = productQuantityMap.get(product.productId) || 0;
        const percentage = (quantity / this.totalOrderedProducts) * 100;
        return { product, percentage: Math.round(percentage * 100) / 100 };
      });
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

  private initChartsLazily() {
    // Use Intersection Observer for lazy chart initialization
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.initChart();
            this.initProfitChart();
            observer.unobserve(entry.target);
          }
        });
      });

      // Observe chart containers
      setTimeout(() => {
        const chartElements = document.querySelectorAll('.chart-container');
        chartElements.forEach(el => observer.observe(el));
      }, 1000);
    } else {
      // Fallback for browsers without IntersectionObserver
      setTimeout(() => {
        this.initChart();
        this.initProfitChart();
      }, 1000);
    }
  }

  async initProfitChart(): Promise<void> {
    try {
      const translations = await this.translate.get([
        'financial_overview', 'revenue', 'product_costs', 'refunds',
        'expenses', 'profit_net', 'profit_analysis'
      ]).toPromise();

      this.profitChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: false },
          y: { stacked: true }
        },
        plugins: {
          legend: { position: 'top' },
          title: {
            display: true,
            text: translations['profit_analysis'],
            font: { size: 16 }
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: this.currency || 'USD',
                  }).format(context.parsed.y);
                }
                return label;
              }
            }
          }
        }
      };
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error initializing profit chart:', error);
    }
  }


  async initChart() {
    try {
      const translations = await this.translate.get([
        'orders_menu_title', 'purchases_menu_title', 'expenses_menu_title'
      ]).toPromise();

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
      const datasets = this.top5Products.map((product: any, index: number) => {
        const salesData = []; // Initialize sales data array for 12 months
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const year = date.getFullYear();
          const month = date.getMonth();
          salesData.push(this.getProductSalesForMonth(product.productId, year, month));
        }

        const color = colors[index % colors.length]; // Rotate through predefined colors

        return {
          label: product.name,
          data: salesData,
          fill: false,
          backgroundColor: color, // Rotate through 6 colors
          borderColor: color,
          tension: .4
        };
      });

      this.chartData = {
        labels: months,
        datasets: datasets
      };

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
            }
          }
        }
      };

      const warehouseNames = Object.keys(this.warehouseProductCounts);
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
              documentStyle.getPropertyValue('--teal-500')
            ],
            hoverBackgroundColor: [
              documentStyle.getPropertyValue('--indigo-400'),
              documentStyle.getPropertyValue('--purple-400'),
              documentStyle.getPropertyValue('--teal-400')
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

      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error initializing charts:', error);
    }
  }

  // ==================== PROFIT ANALYSIS ====================

  onFilterChange(): void {
    this.filterChange$.next();
  }

  async loadProfitData() {
    if (this.profitLoading) return;

    this.profitLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    try {
      const shopId = this.selectedShop?.shopId;
      const data = await (await this.analysisService.getProfitAnalysis(this.selectedPeriod, shopId)).toPromise();

      this.profitData = data;
      await this.updateProfitChart(data);
    } catch (err) {
      this.error = 'Failed to load profit data';
      console.error('Error loading profit data:', err);
    } finally {
      this.profitLoading = false;
      this.cdr.markForCheck();
    }
  }

  async updateProfitChart(data: any): Promise<void> {
    try {
      const translations = await this.translate.get([
        'financial_overview', 'revenue', 'product_costs', 'refunds',
        'expenses', 'purchases', 'profit_margin'
      ]).toPromise();

      if (!data || data.totalRevenue === undefined || data.totalCosts === undefined) {
        console.error('Invalid data received for chart update');
        return;
      }

      this.profitChartData = {
        labels: [translations['financial_overview']],
        datasets: [
          {
            label: translations['revenue'],
            data: [data.totalRevenue],
            backgroundColor: '#4bc0c0',
            borderColor: '#4bc0c0'
          },
          {
            label: translations['product_costs'],
            data: [-data.totalCosts],
            backgroundColor: '#ff6384',
            borderColor: '#ff6384'
          },
          {
            label: translations['refunds'],
            data: [-data.totalRefunds],
            backgroundColor: '#ff9f40',
            borderColor: '#ff9f40'
          },
          {
            label: translations['expenses'],
            data: [-data.totalExpenses],
            backgroundColor: '#9966ff',
            borderColor: '#9966ff'
          },
          {
            label: translations['profit_margin'],
            data: [data.netProfit],
            backgroundColor: '#4bc0c0',
            borderColor: '#4bc0c0',
            type: 'bar'
          }
        ]
      };
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error updating profit chart:', error);
    }
  }

  // ==================== SHOP MANAGEMENT ====================

  async loadShops(): Promise<void> {
    try {
      const translations = await this.translate.get(['All Shops']).toPromise();
      const shops = await (await this.analysisService.getShops()).toPromise();

      this.shops = shops || [];
      this.shopOptions = [
        { label: translations['All Shops'], value: null },
        ...this.shops.map(shop => ({ label: shop.shopName, value: shop }))
      ];
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading shops:', error);
      this.shops = [];
      this.shopOptions = [];
    }
  }

  // ==================== PROFIT INDICATOR ====================

  calculateIndicatorPosition(): string {
    if (!this.profitData?.totalRevenue) return '50%';
    const marginPercentage = this.calculateProfitMargin();
    const position = 50 + (marginPercentage / 2);
    return Math.min(Math.max(position, 5), 95) + '%';
  }

  calculateProfitMargin(): number {
    if (this.profitData?.totalRevenue > 0) {
      return (this.profitData.netProfit / this.profitData.totalRevenue) * 100;
    }
    return 0;
  }

  async refreshDashboard(): Promise<void> {
    this.refreshDashboardLoading = true;
    this.cache.clear(); // Clear cache to force fresh data
    this.cdr.markForCheck();
    
    try {
      // Reload all data
      await this.loadTodayMetrics();
      this.loadSecondaryData();
      this.loadAnalyticsData();
      
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

}
