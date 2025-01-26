import { Component, OnInit, OnDestroy } from '@angular/core';
import { MenuItem } from 'primeng/api';

import { Subscription, debounceTime, forkJoin } from 'rxjs';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { OrderService } from 'src/app/services/order.service';
import { Order } from 'src/app/models/order';
import { ProductService } from 'src/app/services/product.service';
import { Product } from 'src/app/models/product';
import { CustomerService } from 'src/app/services/customer.service';
import { Customer } from 'src/app/models/customer';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { Notification } from 'src/app/models/notification';
import moment from 'moment';
import { NotificationService } from 'src/app/services/notification.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { PurchaseService } from 'src/app/services/purchase.service';
import { ExpenseService } from 'src/app/services/expense.service';
import { KeycloakService } from 'keycloak-angular';

@Component({
    templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {

    items!: MenuItem[];

    orders?: any;

    todayOrders?: any;

    canceledOrders?: any = null;

    deliveredOrders?: any = null;

    chartData: any;

    chartOptions: any;

    subscription!: Subscription;

    products?: any;

    recentOrderedProducts?: any;

    totalOrderedProducts: any = null;

    productPercentages: { product: any, percentage: number }[] = [];

    top5Products?: any;

    lastWeekProducts?: any;

    customers?: any;

    todayCustomers?: any;

    totalOrders: any;

    ordersStatistics: any;

    expensesStatistics: any;

    purchasesStatistics: any;

    revenue: any = 0;

    todayRevenue: any = 0;

    yesterdayRevenue: any = 0;

    revenueDifferencePercentage: number = 0;

    totalSales: number = 0;

    warehouseProductCounts: { [warehouseName: string]: number } = {};

    outOfStockProducts: any[] = [];
    lowStockProducts: any[] = [];

    recentNotifications: Notification[] = [];
    olderNotifications: Notification[] = [];
    recentPage: number = 0;
    pageSize: number = 10;
    loadMoreVisible: boolean = true;
    displayedNotificationIds: Set<number> = new Set<number>();

    userRoles: any;
    isAdmin: boolean = false;

    pieData: any;
    pieOptions: any;

    barData: any;
    barOptions: any;

    currency: any;
    isLoading = true;

    constructor(private orderService: OrderService,
        private productService: ProductService,
        private purchaseService: PurchaseService,
        private expenseService: ExpenseService,
        private customerService: CustomerService,
        public layoutService: LayoutService,
        private translate: TranslateService,
        private translateService: TranslationService,
        private notificationService: NotificationService,
        private configService: AppConfigurationService,
        public keycloakService: KeycloakService,
    ) {
        this.subscription = this.layoutService.configUpdate$
            .pipe(debounceTime(25))
            .subscribe((config) => {
                this.initChart();
            });
    }

    async ngOnInit() {

        this.isLoading = true;

        this.translateService.currentLanguage$.subscribe(lang => {
            this.translate.use(lang); // Use the translate service to update language
        });

        await this.setUserRoles();
        
        forkJoin([
            this.getOrders(),
            this.getTodayOrders(),
            this.getTotalOrderedProducts(),
            this.getRecentOrderedProducts(),
            this.getTop5Products(),
            this.getProducts(),
            this.getProductsOfLastWeek(),
            this.getCustomers(),
            this.getTodayCustomers(),
            this.loadOrdersMonthlyStatistics(),
            this.loadExpensesMonthlyStatistics(),
            this.loadPurchasesMonthlyStatistics()
        ]).subscribe({
            next: ([orders, todayOrders, totalOrderedProducts, recentOrderedProducts, top5Products, products, lastWeekProducts, customers, todayCustomers, ordersStatistics, expensesStatistics, purchasesStatistics]) => {
                this.orders = orders;
                this.todayOrders = todayOrders;
                this.totalOrderedProducts = totalOrderedProducts;
                this.ordersStatistics = ordersStatistics;
                console.log(ordersStatistics)
                this.expensesStatistics = expensesStatistics;
                this.purchasesStatistics = purchasesStatistics;
                this.totalOrders = this.orders.length;
                this.recentOrderedProducts = recentOrderedProducts;
                this.top5Products = top5Products;
                this.categorizeOrdersByStatus()
                this.revenue = this.orders.reduce((sum, element) => sum + element.totalAmount, 0);
                this.todayRevenue = this.todayOrders.reduce((sum, element) => sum + element.totalAmount, 0);
                this.calculateYesterdayRevenue();
                this.calculateRevenueDifferencePercentage();
                this.loadOrders()
                this.products = products;
                this.updateWarehouseProductCounts();
                this.lastWeekProducts = lastWeekProducts;
                this.categorizeProductsByStockStatus();
                this.customers = customers;
                this.todayCustomers = todayCustomers;
                this.initChart();

            },
            error: (error) => {
                console.error("Error loading data: ", error);
                // Optionally handle the error here, e.g., by displaying an error message
            },
            complete: () => {
                // Set loading to false after data is fully loaded
                this.isLoading = false;
            }
        });

        this.loadRecentNotifications();

        this.onGetCurrecy();

    }



    async initChart() {
        const translations = await this.translate.get(['orders_menu_title', 'purchases_menu_title', 'expenses_menu_title']).toPromise();
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
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: textColorSecondary
                    },
                    grid: {
                        color: surfaceBorder,
                        drawBorder: false
                    }
                },
                y: {
                    ticks: {
                        color: textColorSecondary
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
            plugins: {
                legend: {
                    labels: {
                        usePointStyle: true,
                        color: textColor
                    }
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

    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    private async setUserRoles() {
        this.userRoles = await this.keycloakService.getUserRoles();
        this.isAdmin = this.userRoles.includes('ADMIN');
      }

    getOrders() {
        return this.orderService.getOrders();
    }
    getTodayOrders() {
        return this.orderService.getTodayOrders();
    }

    getTop5Products() {
        return this.orderService.get5TopProducts();
    }

    getTotalOrderedProducts() {
        return this.orderService.getTotalOrderedProducts();
    }

    getRecentOrderedProducts() {
        return this.orderService.getRecentOrders();
    }

    loadOrdersMonthlyStatistics() {
        return this.orderService.getMonthlyOrders();
    }

    loadPurchasesMonthlyStatistics() {
        return this.purchaseService.getMonthlyOrders();
    }

    loadExpensesMonthlyStatistics() {
        return this.expenseService.getMonthlyOrders();
    }

    getProducts() {
        return this.productService.getProducts();
    }

    getProductsOfLastWeek() {
        return this.productService.getProductsOfLastWeek();
    }

    getCustomers() {
        return this.customerService.getCustomers();
    }
    getTodayCustomers() {
        return this.customerService.getTodayCustomers();
    }

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
            // Avoid division by zero
            this.revenueDifferencePercentage = this.todayRevenue > 0 ? 100 : 0;
        } else {
            this.revenueDifferencePercentage = ((this.todayRevenue - this.yesterdayRevenue) / this.yesterdayRevenue) * 100;
        }
    }

    categorizeProductsByStockStatus() {
        this.outOfStockProducts = this.products.filter(product => product.inventoryStatus === 'OUTOFSTOCK');
        this.lowStockProducts = this.products.filter(product => product.inventoryStatus === 'LOWSTOCK');
    }

    categorizeOrdersByStatus() {
        this.canceledOrders = this.todayOrders.filter(order => order.orderStatus === 'Canceled');
        this.deliveredOrders = this.todayOrders.filter(order => order.orderStatus === 'Delivered');
    }

    loadRecentNotifications() {
        this.notificationService.getRecentNotifications(this.recentPage, this.pageSize).subscribe(
            data => {
                const today = moment().startOf('day');

                // Filter and add notifications to recentNotifications
                const newRecentNotifications = data.content.filter((notification: any) =>
                    moment(notification.creationDate).isSameOrAfter(today) && !this.displayedNotificationIds.has(notification.id)
                );

                this.recentNotifications = this.recentNotifications.concat(newRecentNotifications);
                newRecentNotifications.forEach(notification => this.displayedNotificationIds.add(notification.id));

                // Filter and add notifications to olderNotifications
                const newOlderNotifications = data.content.filter((notification: any) =>
                    moment(notification.creationDate).isBefore(today) && !this.displayedNotificationIds.has(notification.id)
                );

                this.olderNotifications = this.olderNotifications.concat(newOlderNotifications);
                newOlderNotifications.forEach(notification => this.displayedNotificationIds.add(notification.id));

                if (!data.last) {
                    this.recentPage++;
                } else {
                    this.loadMoreVisible = false;
                }
                console.log(this.recentNotifications)
            },
            error => console.error(error)
        );
    }


    calculatePercentages(productQuantityMap: Map<number, number>): void {
        if (this.totalOrderedProducts > 0 && this.top5Products.length > 0) {
            this.productPercentages = this.top5Products.map(product => {
                const quantity = productQuantityMap.get(product.productId) || 0;
                const percentage = (quantity / this.totalOrderedProducts) * 100;
                return { product, percentage: Math.round(percentage * 100) / 100 };
            });
            console.log(this.productPercentages)
        }
    }


    loadOrders(): void {
        this.totalOrderedProducts = 0;

        const productQuantityMap: Map<number, number> = new Map(); // Product ID to quantity map
        console.log(this.orders)
        this.orders.forEach(order => {
            order.orderItems.forEach(orderItem => {
                this.totalOrderedProducts += orderItem.quantity;

                // Update product quantity map
                const productId = orderItem.product.productId;
                const quantity = productQuantityMap.get(productId) || 0;
                productQuantityMap.set(productId, quantity + orderItem.quantity);
            });
        });
        console.log(productQuantityMap)

        this.calculatePercentages(productQuantityMap);

        console.log(productQuantityMap)
    }

    updateWarehouseProductCounts() {
        this.warehouseProductCounts = {}; // Reset counts
        this.products.forEach(product => {
            if (product.warehouse && product.warehouse.name) {
                const warehouseName = product.warehouse.name;
                this.warehouseProductCounts[warehouseName] = (this.warehouseProductCounts[warehouseName] || 0) + 1;
            }
        });
    }

    getProductSalesForMonth(productId: number, year: number, month: number): number {
        // Calculate sales for the specified product, year, and month
        this.totalSales = 0;
        this.orders.forEach(order => {
            const orderDate = new Date(order.creationDate);
            if (orderDate.getFullYear() === year && orderDate.getMonth() === month) {
                order.orderItems.forEach(orderItem => {
                    if (orderItem.product.productId === productId) {
                        this.totalSales += orderItem.quantity;
                    }
                });
            }
        });
        return this.totalSales;
    }


    getCustomMessage(notification: Notification): string {
        let notificationTitles = ["product in low stock", "product is out of stock"]

        if (notificationTitles.includes(notification.title)) {
            // Extract product name
            const productNameMatch = notification.message.match(/\(([^)]+)\)/);
            return productNameMatch ? productNameMatch[1] : null;
        }
        return notification.message;
    }

    async onGetCurrecy() {
        await (await this.configService.getConfigurationValue('currency'))
            .subscribe({
                next: (response: any) => {
                    this.currency = response;
                    console.log(this.currency)
                },
                error: (err: any) => {
                    console.log(err)
                }
            })
    }
}
