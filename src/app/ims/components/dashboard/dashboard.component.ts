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

@Component({
    templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {

    items!: MenuItem[];

    orders?: any;

    chartData: any;

    chartOptions: any;

    subscription!: Subscription;

    products?: any;

    customers?: any;

    totalOrders: any;

    revenue: any = 0;

    constructor(private orderService: OrderService,
        private productService: ProductService,
        private customerService: CustomerService,
        public layoutService: LayoutService,
        private translate: TranslateService,
    private translateService: TranslationService
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
            this.getProducts(),
            this.getCustomers()
        ]).subscribe(([orders, products, customers]) => {
            this.orders = orders;
            this.totalOrders = this.orders.length;
    
            // Calculate revenue after orders are loaded
            this.revenue = this.orders.reduce((sum, element) => sum + element.totalAmount, 0);
            console.log(this.revenue);
    
            this.products = products;
            this.customers = customers;
        });
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

getProducts() {
    return this.productService.getProducts();
}

getCustomers() {
    return this.customerService.getCustomers();
}

}
