import { Component, OnInit, Pipe, PipeTransform } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Customer } from 'src/app/models/customer';
import { Country, State } from 'country-state-city';
import { CustomerService } from 'src/app/services/customer.service';
import { TranslationService } from 'src/app/services/translation.service';
import { TranslateService } from '@ngx-translate/core';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Order } from 'src/app/models/order';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom } from 'rxjs';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { OrderReturn } from 'src/app/models/orderReturn';
import { Payment } from 'src/app/models/payment';
import { LocationService } from 'src/app/services/location.service';

@Pipe({ name: 'absolute' })
export class AbsolutePipe implements PipeTransform {
  transform(value: number): number {
    return Math.abs(value);
  }
}

@Component({
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.css', '../inventory.component.css'],
  providers: [MessageService]
})
export class CustomersComponent implements OnInit {

  Ressource: string = 'CUSTOMERS';

  first = 0;

  rows = 10;

  customerDialog: boolean = false;

  deleteCustomerDialog: boolean = false;

  deleteCustomersDialog: boolean = false;

  customers: Customer[] = [];

  customer: Customer = {};

  selectedCustomers: Customer[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  countries: any;

  selectedCountry: any = null;

  states: any = null;

  displayHistoryDialog: boolean = false;

  customerOrders: Order[] = [];

  customerReturns: OrderReturn[] = [];

  customerPayments: Payment[] = [];

  orderStatusChartData: any;
  monthlySpendingChartData: any;
  chartOptions: any;
  barChartOptions: any;

  exportColumns!: ExportColumn[];

  Math = Math;

  // Permissions
  canAddCustomer: boolean = false;
  canEditCustomer: boolean = false;
  canDeleteCustomer: boolean = false;
  canReadHistory: boolean = false;
  isLoading: boolean = true;
  currency: any;
  paymentStatuses: { label: string; value: string; }[];

  constructor(private messageService: MessageService,
    private customerService: CustomerService,
    private reportingService: ReportingService,
    private configService: AppConfigurationService,
    private locationService: LocationService,
    private translate: TranslateService,
    public keycloakService: KeycloakService,
    private translateService: TranslationService,
    private permissionService: PermissionService,) { }

  async ngOnInit() {
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

    await this.checkPermissions();
    this.onGetAllCustomers();
    this.initializeStatuses();

    this.initChartOptions();

    this.cols = [
      { field: 'customerId', header: this.translateService.instant('customer_id') },
      { field: 'firstName', header: this.translateService.instant('customer_first_name') },
      { field: 'lastName', header: this.translateService.instant('customer_last_name') },
      { field: 'companyName', header: this.translateService.instant('customer_company_name') },
      { field: 'email', header: this.translateService.instant('customer_email') },
      { field: 'country', header: this.translateService.instant('customer_country') },
      { field: 'city', header: this.translateService.instant('customer_city') },
      { field: 'address', header: this.translateService.instant('customer_address') },
      { field: 'zip', header: this.translateService.instant('customer_zip') },
      { field: 'phoneNumber', header: this.translateService.instant('customer_phone_number') },
      { field: 'customerType', header: this.translateService.instant('customer_type') },
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
  }

  private initializeStatuses() {
    this.statuses = [
      { label: 'Ordered', value: 'Ordered' },
      { label: 'Delivered', value: 'Delivered' },
      { label: 'Canceled', value: 'Canceled' },
      { label: 'Completed', value: 'Completed' },
      { label: 'Returned', value: 'Returned' },
      { label: 'Partial_Return', value: 'Partial_Return' },
      { label: 'Processing', value: 'Processing' },
    ];

    this.paymentStatuses = [
      { label: 'Paid', value: 'PAID' },
      { label: 'Partially Paid', value: 'PARTIALLY_PAID' },
      { label: 'Unpaid', value: 'UNPAID' },
      { label: 'Pending', value: 'PENDING' },
      { label: 'Failed', value: 'FAILED' },
      { label: 'Refunded', value: 'REFUNDED' },
    ];
  }

  async loadCustomerData(): Promise<void> {
    // Load orders, returns, payments for customer
    await this.getCustomerOrders(this.customer.customerId);
    await this.getCustomerReturns(this.customer.customerId);
    await this.getCustomerPayments(this.customer.customerId);

    // After loading data, prepare charts
    this.prepareCharts();
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

  prepareCharts(): void {
    // Order status chart
    const statusCounts = this.countByStatus(this.customerOrders, 'orderStatus');
    this.orderStatusChartData = {
      labels: Object.keys(statusCounts).map(key =>
        this.translate.instant('order_status_' + key.toLowerCase())
      ),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [
          '#FFA726', // PENDING
          '#42A5F5', // PROCESSING
          '#66BB6A', // COMPLETED
          '#EF5350'  // CANCELLED
        ],
        hoverBackgroundColor: [
          '#FFB74D',
          '#64B5F6',
          '#81C784',
          '#E57373'
        ]
      }]
    };

    // Monthly spending chart
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
    // Generate a consistent color based on customer ID
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    return colors[Math.abs(customer.customerId) % colors.length];
  }

  getFullAddress(customer: any): string {
    if (!customer) return '';

    const translatedCountry = this.countries?.find(c => c.name === customer.country)?.translatedName || customer.country;

    return [
      customer.address,
      customer.city,
      customer.state,
      customer.postalCode,
      translatedCountry
    ].filter(part => part).join(', ');
  }

  getFormattedTrend(trendValue: number): string {
    if (trendValue > 0) {
      return `+${trendValue.toFixed(1)}%`;
    } else if (trendValue < 0) {
      return `${trendValue.toFixed(1)}%`;
    }
    return '0%';
  }

  deleteSelectedCustomers() {
    if (!this.canDeleteCustomer) return;
    this.deleteCustomersDialog = true;
  }

  editCustomer(customer: Customer) {
    if (!this.canEditCustomer) return;
    this.selectedCountry = {};
    this.customer = { ...customer };
    this.customerDialog = true;
    this.onSelectedCountry(this.customer.country)
  }

  deleteCustomer(customer: Customer) {
    if (!this.canDeleteCustomer) return;
    this.deleteCustomerDialog = true;
    this.customer = { ...customer };
  }

  async confirmDeleteSelected() {
    this.deleteCustomersDialog = false;
    try {
      for (const selectedCustomer of this.selectedCustomers) {
        await this.onDeleteCustomer(selectedCustomer.customerId);
      }
      this.selectedCustomers = [];
    } catch (error) {
      console.error(error);
    }
  }

  async confirmDelete() {
    this.deleteCustomerDialog = false;
    try {
      await this.onDeleteCustomer(this.customer.customerId);
      this.customer = {};
    } catch (error) {
      console.error(error);
    }
  }

  hideDialog() {
    this.customerDialog = false;
    this.submitted = false;
    this.displayHistoryDialog = false;
    this.selectedCountry = {};
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddCustomer = this.permissionService.canCreate(this.Ressource);
    this.canEditCustomer = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteCustomer = this.permissionService.canDelete(this.Ressource);
    this.canReadHistory = this.permissionService.canHistoryRead(this.Ressource);
  }

  openNew() {
    if (!this.canAddCustomer) return;
    this.selectedCountry = {};
    this.customer = {};
    this.submitted = false;
    this.customerDialog = true;
  }

  saveCustomer() {
    this.submitted = true;

    // Validate customer type
    if (!this.customer.customerType) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('required_field'),
        detail: this.translate.instant('customer_type_required'),
        life: 3000
      });
      return;
    }

    // Validate type-specific fields
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

    // Process save or update
    try {
      if (this.customer.customerId) {
        this.updateCustomer(this.customer.customerId, this.customer);
      } else {
        this.addCustomer(this.customer);
      }
      this.customers = [...this.customers];
      this.customerDialog = false;
      if (!this.displayHistoryDialog) {
        this.customer = {};
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('unexpected_error_occurred'),
        life: 3000
      });
      console.error('Error saving customer:', error);
    }
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }


  async onGetAllCustomers() {
    await this.customerService.getCustomers()
      .subscribe({
        next: (response: any) => {
          this.customers = response;
          console.log(this.customers);
          this.customers.forEach((customer: any) => (customer.creationDate = new Date(<Date>customer.creationDate)));
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_customers'),
            life: 3000
          });
          console.log(err)
        },
        complete: () => {
          this.isLoading = false;
        }
      })
  }

  async onDeleteCustomer(id: any) {
    await this.customerService.deleteCustomer(id)
      .subscribe({
        next: (response: any) => {
          this.onGetAllCustomers();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('customer_deleted'),
            life: 3000
          });
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_deleting_customer'),
            life: 3000
          });
          console.log(err);
        },
      });
  }


  async updateCustomer(id: any, customer: any): Promise<any> {
    await this.customerService.updateCustomer(id, customer)
      .subscribe({
        next: (response: any) => {
          this.onGetAllCustomers();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('customer_updated'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_customer'),
            life: 3000
          });
          console.log(err);
          return false;
        },
      });
  }

  async addCustomer(data: any): Promise<any> {
    await this.customerService.saveCustomer(data)
      .subscribe({
        next: (response: any) => {
          this.onGetAllCustomers();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('customer_added'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_customer'),
            life: 3000
          });
          console.log(err);
          return false;
        },
      });
  }

  onChangeCountry() {
    this.customer.city = undefined;
  }

  onSelectedCountry(event) {
    if ((this.customer.country != this.selectedCountry) && (this.customer.city == undefined)) this.customer.city = undefined;
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

  async openCustomerHistoryDialog(customer: Customer) {
    if (!this.canReadHistory) return;
    this.customerOrders = [];
    this.customer = { ...customer };
    this.displayHistoryDialog = true;
    await this.loadCustomerData();
    //await this.getCustomerOrders(this.customer.customerId);
    console.log(this.customerOrders);
  }

  async getCustomerOrders(id: any) {
    try {
      const response = await firstValueFrom(this.customerService.getCustomerOrders(id));
      this.customerOrders = response as Order[];
      console.log(this.customerOrders);
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
      this.customerReturns = response as Order[];
      console.log(this.customerReturns);
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
      this.customerPayments = response as Order[];
      console.log(this.customerPayments);
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

  exportPdf() {
    this.reportingService.exportPdf(this.exportColumns, this.customers, 'customers')
  }

  exportExcel() {
    // Clone the suppliers array to avoid modifying the original array
    const modifiedCustomers = this.customers.map(customer => {
      // Create a copy of the supplier object to modify
      const modifiedCustomer = { ...customer };

      // Remove the column you want to exclude
      delete modifiedCustomer.creationDate;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedSupplier['columnToRemove'];

      return modifiedCustomer;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedCustomers, 'customers');
  }

  next() {
    this.first = this.first + this.rows;
  }

  prev() {
    this.first = this.first - this.rows;
  }

  reset() {
    this.first = 0;
  }

  pageChange(event) {
    this.first = event.first;
    this.rows = event.rows;
  }

  isLastPage(): boolean {
    return this.customerOrders ? this.first === this.customerOrders.length - this.rows : true;
  }

  isFirstPage(): boolean {
    return this.customerOrders ? this.first === 0 : true;
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

  // Calculate remaining balance
  getRemainingBalance(): number {
    return this.getTotalSpent() - this.getTotalPaid();
  }

  getPaymentCompletionRate(): number {
    return this.getTotalSpent() > 0 ? this.getTotalPaid() / this.getTotalSpent() : 1;
  }

  getOverdueAmount(): number {
    return this.customerOrders
      .filter(order => order.paymentStatus === 'OVERDUE')
      .reduce((sum, order) => sum + (order.totalAmount - order.totalPaid), 0);
  }

  getOrderCountTrend(): number {
    if (!this.customerOrders || this.customerOrders.length === 0) {
      return 0;
    }

    // Get current date and date 30 days ago for comparison
    const currentDate = new Date();
    const pastDate = new Date();
    pastDate.setDate(currentDate.getDate() - 30);

    // Filter orders for current period (last 30 days) and previous period (30-60 days ago)
    const currentPeriodOrders = this.customerOrders.filter(order =>
      new Date(order.orderDate) >= pastDate
    );

    const previousPeriodOrders = this.customerOrders.filter(order => {
      const orderDate = new Date(order.orderDate);
      const previousPeriodStart = new Date(pastDate);
      previousPeriodStart.setDate(pastDate.getDate() - 30);
      return orderDate >= previousPeriodStart && orderDate < pastDate;
    });

    // Calculate order counts
    const currentCount = currentPeriodOrders.length;
    const previousCount = previousPeriodOrders.length;

    // Calculate trend (percentage change)
    if (previousCount === 0) {
      return currentCount > 0 ? 100 : 0; // Handle division by zero
    }

    return ((currentCount - previousCount) / previousCount) * 100;
  }

  getSpendingTrend(): number {
    // Compare current period with previous period
    // Implementation depends on your business logic
    return 0;
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

  getReturnStatusSeverity(status: string): string {
    switch (status) {
      case 'PROCESSED':
      case 'REFUNDED': return 'success';
      case 'PENDING': return 'warning';
      case 'REJECTED': return 'danger';
      default: return 'info';
    }
  }

  getTotalReturnsAmount(): number {
    return this.customerReturns?.reduce((sum, ret) => sum + (ret.totalRefundableAmount || 0), 0) || 0;
  }

  getTotalPaymentsAmount(): number {
    return this.customerPayments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
  }

  printOrder(order: any): void {
    // Implement order printing
  }

  contactCustomer(): void {
    if (this.customer.email) {
      window.location.href = `mailto:${this.customer.email}`;
    } else if (this.customer.phoneNumber) {
      window.location.href = `tel:${this.customer.phoneNumber}`;
    }
  }

  createNewOrder(): void {
    // Implement new order creation
  }

  printCustomerHistory(): void {
    window.print();
  }


  // exportToPDF(): void {
  //   // Implement PDF export
  // }

  clearFilters(table: any): void {
    table.clear();
  }

  refreshData(): void {
    this.loadCustomerData();
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('data_refreshed'),
      detail: this.translate.instant('customer_data_has_been_refreshed')
    });
  }

  viewReturnDetails(returnItem: any): void {
    // Implement return details view
  }

  viewPaymentDetails(payment: any): void {
    // Implement payment details view
  }

  printReturn(returnItem: any): void {
    // Implement return printing
  }

  printPaymentReceipt(payment: any): void {
    // Implement payment receipt printing
  }

  // Get payment status class
  getPaymentStatusClass(order: any): string {
    if (order.totalPaid >= order.totalAmount) return 'paid';
    if (order.totalPaid > 0) return 'partial';
    return 'unpaid';
  }

  getStatusSeverity(status: string): string {
    switch (status?.toUpperCase()) {
      case 'COMPLETED': return 'success';
      case 'PENDING': return 'warning';
      case 'CANCELLED': return 'danger';
      default: return 'info';
    }
  }

  viewOrderDetails(order: any) {
    // Implement your order details view logic here
    console.log('View order details:', order);
  }

  // exportToExcel() {
  //   // Implement export to Excel functionality
  //   console.log('Exporting to Excel');
  // }

  private countByStatus(items: any[], field: string): { [key: string]: number } {
    return items.reduce((acc, item) => {
      const status = item[field];
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }

  private groupByMonth(orders: any[]): { [key: string]: number } {
    return orders.reduce((acc, order) => {
      const month = new Date(order.orderDate).toLocaleString('default', { month: 'short', year: 'numeric' });
      acc[month] = (acc[month] || 0) + order.totalAmount;
      return acc;
    }, {});
  }


  getLastOrderDate(): Date | null {
    if (!this.customerOrders?.length) return null;

    const sorted = [...this.customerOrders].sort((a, b) => {
      const dateA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
      const dateB = b.orderDate ? new Date(b.orderDate).getTime() : 0;
      return dateB - dateA; // descending order
    });

    return sorted[0].orderDate ? new Date(sorted[0].orderDate) : null;
  }

  printCustomerDetails(): void {
    window.print();
  }

  isEmptyCustomer(customer: any): boolean {
    if (!customer) return true;

    const hasAnyField =
      customer.email ||
      customer.phoneNumber ||
      customer.address ||
      customer.city ||
      customer.country ||
      customer.customerType ||
      customer.companyName ||
      customer.cin ||
      customer.ice ||
      (this.customerOrders?.length) ||
      (this.customerReturns?.length) ||
      (this.customerPayments?.length);

    return !hasAnyField;
  }


}
