import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Customer } from 'src/app/models/customer';
import { CustomerService } from 'src/app/services/customer.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Order } from 'src/app/models/order';
import { OrderReturn } from 'src/app/models/orderReturn';
import { Payment } from 'src/app/models/payment';
import { LocationService } from 'src/app/services/location.service';

@Component({
  templateUrl: './customer-details.component.html',
  styleUrls: ['./customer-details.component.css', '../../inventory.component.css'],
  providers: [MessageService]
})
export class CustomerDetailsComponent implements OnInit {

  customerId!: number;
  customer: Customer | null = null;
  customerOrders: Order[] = [];
  customerReturns: OrderReturn[] = [];
  customerPayments: Payment[] = [];

  isLoading: boolean = true;
  currency: string = 'USD';

  orderStatusChartData: any;
  monthlySpendingChartData: any;
  chartOptions: any;
  barChartOptions: any;

  canEditCustomer: boolean = false;
  Ressource: string = 'CUSTOMERS';

  customerDialog: boolean = false;
  submitted: boolean = false;
  selectedCountry: any = null;
  states: any = null;
  countries: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private customerService: CustomerService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private locationService: LocationService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
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
      this.customerId = +params['id'];
      await this.checkPermissions();
      await this.loadCustomer();
      await this.loadCustomerData();
      this.initChartOptions();
      this.isLoading = false;
    });
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canEditCustomer = this.permissionService.canUpdate(this.Ressource);
  }

  async loadCustomer() {
    try {
      const customers = await firstValueFrom(this.customerService.getCustomers()) as Customer[];
      this.customer = customers.find((c: Customer) => c.customerId === this.customerId) || null;
      if (!this.customer) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('customer_not_found'),
          life: 3000
        });
        this.router.navigate(['/inventory/customers']);
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_customer'),
        life: 3000
      });
      this.router.navigate(['/inventory/customers']);
    }
  }

  async loadCustomerData(): Promise<void> {
    await this.getCustomerOrders(this.customerId);
    await this.getCustomerReturns(this.customerId);
    await this.getCustomerPayments(this.customerId);
    this.prepareCharts();
  }

  async getCustomerOrders(id: any) {
    try {
      const response = await firstValueFrom(this.customerService.getCustomerOrders(id));
      this.customerOrders = response as Order[];
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_customer_orders'),
        life: 3000
      });
      console.error(err);
    }
  }

  async getCustomerReturns(id: any) {
    try {
      const response = await firstValueFrom(this.customerService.getCustomerReturns(id));
      this.customerReturns = response as OrderReturn[];
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_customer_returns'),
        life: 3000
      });
      console.error(err);
    }
  }

  async getCustomerPayments(id: any) {
    try {
      const response = await firstValueFrom(this.customerService.getCustomerPayments(id));
      this.customerPayments = response as Payment[];
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_customer_payments'),
        life: 3000
      });
      console.error(err);
    }
  }

  prepareCharts(): void {
    const statusCounts = this.countByStatus(this.customerOrders, 'orderStatus');
    this.orderStatusChartData = {
      labels: Object.keys(statusCounts).map(key =>
        this.translate.instant('order_status_' + key.toLowerCase())
      ),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [
          '#FFA726', '#42A5F5', '#66BB6A', '#EF5350'
        ],
        hoverBackgroundColor: [
          '#FFB74D', '#64B5F6', '#81C784', '#E57373'
        ]
      }]
    };

    const monthlyData = this.groupByMonth(this.customerOrders);
    this.monthlySpendingChartData = {
      labels: Object.keys(monthlyData),
      datasets: [{
        label: this.translate.instant('monthly_spending'),
        data: Object.values(monthlyData),
        backgroundColor: '#9C27B0'
      }]
    };
  }

  initChartOptions(): void {
    this.chartOptions = {
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            usePointStyle: true,
            padding: 20
          }
        }
      }
    };

    this.barChartOptions = {
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: number) => this.currency + value.toFixed(2)
          }
        }
      }
    };
  }

  getInitials(customer: any): string {
    if (!customer) return '';

    if (customer.customerType === 'Company') {
      return (customer.companyName || 'N/A')
        .split(' ')
        .map((word: string) => word.charAt(0))
        .join('')
        .toUpperCase();
    }

    if (customer.firstName && customer.lastName) {
      return (customer.firstName.charAt(0) + customer.lastName.charAt(0)).toUpperCase();
    }

    if (customer.firstName || customer.lastName) {
      return ((customer.firstName || customer.lastName).charAt(0)).toUpperCase();
    }

    return '';
  }

  getCustomerColor(customer: any): string {
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    return colors[Math.abs(customer.customerId) % colors.length];
  }

  getCustomerDisplayName(customer: any): string {
    if (!customer) return '';
    if (customer.customerType === 'Company') {
      return customer.companyName || 'Unnamed Company';
    }
    return [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Unnamed Customer';
  }

  getTotalSpent(): number {
    return this.customerOrders?.reduce((total, order) => total + (order.totalAmount || 0), 0) || 0;
  }

  getTotalPaid(): number {
    return this.customerOrders?.reduce((total, order) => {
      return total + (order.totalPaid || 0);
    }, 0) || 0;
  }

  getRemainingBalance(): number {
    return this.getTotalSpent() - this.getTotalPaid();
  }

  getPaymentCompletionRate(): number {
    return this.getTotalSpent() > 0 ? this.getTotalPaid() / this.getTotalSpent() : 1;
  }

  getLastOrderDate(): Date | null {
    if (!this.customerOrders?.length) return null;

    const sorted = [...this.customerOrders].sort((a, b) => {
      const dateA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
      const dateB = b.orderDate ? new Date(b.orderDate).getTime() : 0;
      return dateB - dateA;
    });

    return sorted[0].orderDate ? new Date(sorted[0].orderDate) : null;
  }

  getTotalReturnsAmount(): number {
    return this.customerReturns?.reduce((sum, r) => sum + (r.totalRefundableAmount || 0), 0) || 0;
  }

  getTotalPaymentsAmount(): number {
    return this.customerPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  }

  private countByStatus(items: any[], statusField: string): { [key: string]: number } {
    return items.reduce((acc, item) => {
      const status = item[statusField] || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }

  private groupByMonth(orders: Order[]): { [key: string]: number } {
    return orders.reduce((acc, order) => {
      const month = new Date(order.orderDate).toLocaleString('default', {
        month: 'short',
        year: 'numeric'
      });
      acc[month] = (acc[month] || 0) + order.totalAmount;
      return acc;
    }, {} as { [key: string]: number });
  }

  editCustomer() {
    if (!this.canEditCustomer || !this.customer) return;
    this.selectedCountry = {};
    this.customer = { ...this.customer };
    this.customerDialog = true;
    if (this.customer.country) {
      this.onSelectedCountry(this.customer.country);
    }
  }

  hideDialog() {
    this.customerDialog = false;
    this.submitted = false;
    this.selectedCountry = {};
    this.loadCustomer();
  }

  onChangeCountry() {
    if (this.customer) {
      this.customer.city = undefined;
    }
  }

  onSelectedCountry(event: string) {
    if (!this.customer) return;
    if ((this.customer.country != this.selectedCountry) && (this.customer.city == undefined)) {
      this.customer.city = undefined;
    }
    this.countries.forEach((element: any) => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    this.states = this.locationService.getStatesByCountryCode(this.selectedCountry.isoCode);
  }

  saveCustomer() {
    this.submitted = true;

    if (!this.customer?.customerType) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('required_field'),
        detail: this.translate.instant('customer_type_required'),
        life: 3000
      });
      return;
    }

    if (this.customer.customerType === 'Particular') {
      if (!this.customer.cin) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('required_field'),
          detail: this.translate.instant('customer_cin_required'),
          life: 3000
        });
        return;
      }
      if (!this.customer.firstName || !this.customer.lastName) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('required_fields'),
          detail: this.translate.instant('customer_first_last_name_required'),
          life: 3000
        });
        return;
      }
    }

    if (this.customer.customerType === 'Company') {
      if (!this.customer.ice) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('required_field'),
          detail: this.translate.instant('customer_ice_required'),
          life: 3000
        });
        return;
      }
      if (!this.customer.companyName) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('required_field'),
          detail: this.translate.instant('customer_company_name_required'),
          life: 3000
        });
        return;
      }
    }

    if (this.customer && this.customer.customerId) {
      this.updateCustomer(this.customer.customerId, this.customer);
    } else {
      this.addCustomer(this.customer);
    }
  }

  async updateCustomer(id: any, customer: any): Promise<any> {
    this.customerService.updateCustomer(id, customer)
      .subscribe({
        next: async (response: any) => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('customer_updated'),
            life: 3000
          });
          this.customerDialog = false;
          this.submitted = false;
          this.selectedCountry = {};
          await this.loadCustomer();
          await this.loadCustomerData();
          this.initChartOptions();
          return true;
        },
        error: (err: any) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_updating_customer'),
            life: 3000
          });
          return false;
        },
      });
  }

  async addCustomer(data: any): Promise<any> {
    await this.customerService.saveCustomer(data)
      .subscribe({
        next: async (response: any) => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('customer_added'),
            life: 3000
          });
          this.customerDialog = false;
          this.submitted = false;
          this.selectedCountry = {};
          await this.loadCustomer();
          await this.loadCustomerData();
          this.initChartOptions();
          return true;
        },
        error: (err: any) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_adding_customer'),
            life: 3000
          });
          return false;
        },
      });
  }

  filterCountry(value: any, filter: string): boolean {
    const normalizedFilter = filter.toLowerCase();
    return (
      value.name.toLowerCase().includes(normalizedFilter) ||
      value.translatedName.toLowerCase().includes(normalizedFilter)
    );
  }

  contactCustomer(): void {
    if (this.customer?.email) {
      window.location.href = `mailto:${this.customer.email}`;
    } else if (this.customer?.phoneNumber) {
      window.location.href = `tel:${this.customer.phoneNumber}`;
    }
  }

  printCustomerDetails(): void {
    window.print();
  }

  refreshData(): void {
    this.loadCustomerData();
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('data_refreshed'),
      detail: this.translate.instant('customer_data_has_been_refreshed')
    });
  }

  isEmptyCustomer(customer: any): boolean {
    if (!customer) return true;

    const hasAnyField =
      customer.email ||
      customer.phoneNumber ||
      customer.address ||
      customer.city ||
      customer.country ||
      (this.customerOrders?.length) ||
      (this.customerReturns?.length) ||
      (this.customerPayments?.length);

    return !hasAnyField;
  }

  goBack(): void {
    this.router.navigate(['/inventory/customers']);
  }

  viewOrderDetails(order: Order): void {
    this.router.navigate(['/sales/orders'], { 
      queryParams: { orderId: order.orderId } 
    });
  }

  viewReturnDetails(returnItem: OrderReturn): void {
    this.router.navigate(['/sales/returns'], { 
      queryParams: { returnId: returnItem.returnId } 
    });
  }

  viewPaymentDetails(payment: Payment): void {
    this.router.navigate(['/finance/payments'], { 
      queryParams: { paymentId: payment.paymentId } 
    });
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
}

