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
import * as moment from 'moment';
import { NotificationService } from 'src/app/services/notification.service';

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

    revenue: any = 0;

    todayRevenue: any = 0;

    yesterdayRevenue: any = 0;

    revenueDifferencePercentage: number = 0;

    outOfStockProducts: any[] = [];
    lowStockProducts: any[] = [];

    recentNotifications: Notification[] = [];
    olderNotifications: Notification[] = [];
    recentPage: number = 0;
    pageSize: number = 10;
    loadMoreVisible: boolean = true;
    displayedNotificationIds: Set<number> = new Set<number>();

    constructor(private orderService: OrderService,
        private productService: ProductService,
        private customerService: CustomerService,
        public layoutService: LayoutService,
        private translate: TranslateService,
        private translateService: TranslationService,
        private notificationService: NotificationService,
    ) {
        this.subscription = this.layoutService.configUpdate$
            .pipe(debounceTime(25))
            .subscribe((config) => {
                this.initChart();
            });
    }

    ngOnInit() {
        this.translateService.currentLanguage$.subscribe(lang => {
            this.translate.use(lang); // Use the translate service to update language
        });
        this.items = [
            { label: 'Add New', icon: 'pi pi-fw pi-plus' },
            { label: 'Remove', icon: 'pi pi-fw pi-minus' }
        ];
        this.initChart();

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

        ]).subscribe(([orders, todayOrders, totalOrderedProducts, recentOrderedProducts, top5Products, products, lastWeekProducts, customers, todayCustomers]) => {
            this.orders = orders;
            this.todayOrders = todayOrders;
            this.totalOrderedProducts = totalOrderedProducts;
            this.totalOrders = this.orders.length;
            this.recentOrderedProducts = recentOrderedProducts;
            this.top5Products = top5Products;
            console.log(top5Products)
            console.log(recentOrderedProducts)
            this.categorizeOrdersByStatus()
            // Calculate revenue after orders are loaded
            this.revenue = this.orders.reduce((sum, element) => sum + element.totalAmount, 0);
            this.todayRevenue = this.todayOrders.reduce((sum, element) => sum + element.totalAmount, 0);
            // Calculate yesterday's revenue
            this.calculateYesterdayRevenue();
            console.log(this.revenue);
            console.log(this.totalOrderedProducts);

            // Calculate revenue difference percentage
      this.calculateRevenueDifferencePercentage();
      this.loadOrders()
            // Categorize products by stock status
            

            this.products = products;
            this.lastWeekProducts = lastWeekProducts;
            this.categorizeProductsByStockStatus();
            this.customers = customers;
            this.todayCustomers = todayCustomers;
            console.log(this.lastWeekProducts)

        });

        this.loadRecentNotifications();


    }



    initChart() {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
        const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

        this.chartData = {
            labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
            datasets: [
                {
                    label: 'First Dataset',
                    data: [65, 59, 80, 81, 56, 55, 40],
                    fill: false,
                    backgroundColor: documentStyle.getPropertyValue('--bluegray-700'),
                    borderColor: documentStyle.getPropertyValue('--bluegray-700'),
                    tension: .4
                },
                {
                    label: 'Second Dataset',
                    data: [28, 48, 40, 19, 86, 27, 90],
                    fill: false,
                    backgroundColor: documentStyle.getPropertyValue('--green-600'),
                    borderColor: documentStyle.getPropertyValue('--green-600'),
                    tension: .4
                }
            ]
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
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
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

    getOrderedProducts(){

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
    


}
