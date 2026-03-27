import { Component, OnInit, Pipe, PipeTransform, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
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
import { CustomerCreditService } from 'src/app/services/customer-credit.service';
import { CreditInfo } from 'src/app/models/credit-info';
import { PricingService } from 'src/app/services/pricing.service';
import { PriceListDTO } from 'src/app/models/pricing';
import { CustomerFormDialogComponent, CustomerFormDialogConfig, CustomerFormDialogData } from './customer-form-dialog/customer-form-dialog.component';
import { DatePipe } from '@angular/common';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';

@Pipe({ name: 'absolute' })
export class AbsolutePipe implements PipeTransform {
  transform(value: number): number {
    return Math.abs(value);
  }
}

@Component({
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.css', '../sales.component.css'],
  providers: [MessageService, DatePipe]
})
export class CustomersComponent implements OnInit {

  Ressource: string = 'CUSTOMERS';

  first = 0;

  rows = 10;


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


  customerOrders: Order[] = [];

  customerReturns: OrderReturn[] = [];

  customerPayments: Payment[] = [];

  orderStatusChartData: any;
  monthlySpendingChartData: any;
  chartOptions: any;
  barChartOptions: any;

  exportColumns!: ExportColumn[];

  Math = Math;
  isFinite = isFinite;

  // Permissions
  canAddCustomer: boolean = false;
  canEditCustomer: boolean = false;
  canDeleteCustomer: boolean = false;
  canReadHistory: boolean = false;
  isLoading: boolean = true;
  isExporting: boolean = false;
  exportProgress: string = '';
  currency: any;
  paymentStatuses: { label: string; value: string; }[];
  
  // ⚠️ NEW: Credit info map for customers
  customerCreditInfo: Map<number, CreditInfo> = new Map();
  loadingCreditInfo: Set<number> = new Set();
  priceLists: PriceListDTO[] = [];
  selectedPriceListId: number | null = null;
  isLoadingPriceLists: boolean = false;

  // Dialog configuration for reusable component
  customerDialogConfig: CustomerFormDialogConfig = {
    visible: false,
    mode: 'create',
    customer: {},
    selectedPriceListId: null,
    isLoadingPriceLists: false
  };

  constructor(private messageService: MessageService,
    private customerService: CustomerService,
    private reportingService: ReportingService,
    private configService: AppConfigurationService,
    private locationService: LocationService,
    private translate: TranslateService,
    public keycloakService: KeycloakService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private router: Router,
    private customerCreditService: CustomerCreditService,
    private pricingService: PricingService,
    private organizationService: OrganizationService,
    private datePipe: DatePipe) { }

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
    await this.loadPriceLists();
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
    this.selectedPriceListId = (this.customer as any)?.priceList?.priceListId ?? (this.customer as any)?.priceList?.id ?? (this.customer as any)?.priceListId ?? null;
    this.customerDialogConfig = {
      visible: true,
      mode: 'edit',
      customer: { ...customer },
      selectedPriceListId: this.selectedPriceListId,
      isLoadingPriceLists: this.isLoadingPriceLists
    };
    this.onSelectedCountry(this.customer.country);
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
    this.customerDialogConfig.visible = false;
    this.submitted = false;
    this.selectedCountry = {};
  }

  onCustomerDialogConfigChange(config: CustomerFormDialogConfig) {
    this.customerDialogConfig = config;
  }

  onCustomerSave(dialogData: CustomerFormDialogData) {
    this.customer = dialogData.customer;
    this.selectedPriceListId = dialogData.selectedPriceListId;
    this.saveCustomer();
  }

  onCustomerCancel() {
    this.hideDialog();
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
    this.selectedPriceListId = null;
    this.customerDialogConfig = {
      visible: true,
      mode: 'create',
      customer: {},
      selectedPriceListId: null,
      isLoadingPriceLists: this.isLoadingPriceLists
    };
  }

  async saveCustomer() {
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
      let savedCustomerId: number | undefined;
      if (this.customer.customerId) {
        const updated = await this.updateCustomer(this.customer.customerId, this.customer);
        savedCustomerId = updated?.customerId || this.customer.customerId;
      } else {
        const created = await this.addCustomer(this.customer);
        savedCustomerId = created?.customerId;
      }

      if (savedCustomerId) {
        await this.applyCustomerPricingProfile(savedCustomerId);
        // Refresh the customer list to show updated pricing profile
        await this.onGetAllCustomers();
      }

      this.customerDialogConfig.visible = false;
      this.customer = {};
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

  @ViewChild('dt') dt!: Table;

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (this.dt) {
      this.dt.filterGlobal(value, 'contains');
    }
  }

  // ⚠️ NEW: Load credit info for a customer
  async loadCreditInfoForCustomer(customerId: number): Promise<void> {
    // If already cached, check if it has invalid netBalance and clear it
    if (this.customerCreditInfo.has(customerId)) {
      const cachedInfo = this.customerCreditInfo.get(customerId);
      if (cachedInfo && this.isInvalidNetBalance(cachedInfo.netBalance)) {
        // Clear invalid cached data
        this.customerCreditInfo.delete(customerId);
      } else if (cachedInfo) {
        return; // Valid cached data, no need to reload
      }
    }
    
    if (this.loadingCreditInfo.has(customerId)) {
      return; // Already loading
    }
    
    this.loadingCreditInfo.add(customerId);
    try {
      this.customerCreditService.loadToken();
      const creditInfo$ = await this.customerCreditService.getCreditInfo(customerId);
      const creditInfo = await firstValueFrom(creditInfo$);
      
      // ⚠️ Sanitize invalid values (Infinity, NaN, or extremely large numbers)
      if (creditInfo) {
        if (this.isInvalidNetBalance(creditInfo.netBalance)) {
          creditInfo.netBalance = null as any;
        }
        if (this.isInvalidNetBalance(creditInfo.availableCreditLimit)) {
          creditInfo.availableCreditLimit = null as any;
        }
        if (this.isInvalidNetBalance(creditInfo.outstandingBalance)) {
          creditInfo.outstandingBalance = null as any;
        }
        if (this.isInvalidNetBalance(creditInfo.overdueBalance)) {
          creditInfo.overdueBalance = null as any;
        }
      }
      
      this.customerCreditInfo.set(customerId, creditInfo);
    } catch (error) {
      console.error(`Error loading credit info for customer ${customerId}:`, error);
      // Set null to avoid retrying
      this.customerCreditInfo.set(customerId, null as any);
    } finally {
      this.loadingCreditInfo.delete(customerId);
    }
  }

  // ⚠️ NEW: Get credit info for a customer
  getCreditInfo(customerId: number): CreditInfo | null {
    return this.customerCreditInfo.get(customerId) || null;
  }

  // Helper method to check if netBalance is invalid
  private isInvalidNetBalance(value: any): boolean {
    // 0 is a valid value, so check for it explicitly
    if (value === 0) {
      return false; // 0 is valid
    }
    
    if (value === undefined || value === null) {
      return false; // null/undefined is valid (means no data)
    }
    
    const valueStr = String(value).toUpperCase();
    
    // Check for scientific notation with large exponent
    if (valueStr.includes('E+')) {
      const match = valueStr.match(/E\+(\d+)/);
      if (match && parseInt(match[1]) >= 15) {
        return true; // Exponent >= 15 means extremely large
      }
    }
    
    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Check if it's 0 after parsing
    if (numValue === 0) {
      return false; // 0 is valid
    }
    
    const absValue = Math.abs(numValue);
    
    // Check for invalid values
    return !isFinite(numValue) || isNaN(numValue) || 
           absValue > 1e15 || 
           absValue >= Number.MAX_VALUE * 0.9;
  }

  // ⚠️ NEW: Safely get net balance value (handles invalid/very large numbers)
  getSafeNetBalance(customerId: number): number | null {
    const creditInfo = this.getCreditInfo(customerId);
    if (!creditInfo || creditInfo.netBalance === undefined || creditInfo.netBalance === null) {
      return null;
    }
    
    // Use the helper method to check if the value is invalid
    if (this.isInvalidNetBalance(creditInfo.netBalance)) {
      // Sanitize it in the stored data and return null
      creditInfo.netBalance = null as any;
      return null;
    }
    
    // Convert to number if it's a string, otherwise return as-is
    return typeof creditInfo.netBalance === 'string' ? parseFloat(creditInfo.netBalance) : creditInfo.netBalance;
  }

  async onGetAllCustomers() {
    // Clear credit info cache when reloading customers
    this.customerCreditInfo.clear();
    this.loadingCreditInfo.clear();
    
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
    try {
      const response = await firstValueFrom(this.customerService.updateCustomer(id, customer));
      this.onGetAllCustomers();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('customer_updated'),
        life: 3000
      });
      return response;
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_updating_customer'),
        life: 3000
      });
      console.log(err);
      throw err;
    }
  }

  async addCustomer(data: any): Promise<any> {
    try {
      const response = await firstValueFrom(this.customerService.saveCustomer(data));
      this.onGetAllCustomers();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('customer_added'),
        life: 3000
      });
      return response;
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_adding_customer'),
        life: 3000
      });
      console.log(err);
      throw err;
    }
  }

  async loadPriceLists(): Promise<void> {
    this.isLoadingPriceLists = true;
    try {
      const lists = await firstValueFrom(await this.pricingService.getPriceLists());
      this.priceLists = Array.isArray(lists) ? lists : [];
    } catch (error) {
      console.error('Error loading price lists:', error);
      this.priceLists = [];
    } finally {
      this.isLoadingPriceLists = false;
    }
  }

  getPriceListLabel(list: PriceListDTO | null | undefined): string {
    if (!list?.name) return '';
    const key = `price_list_${list.name.toLowerCase()}`;
    const translated = this.translate.instant(key);
    return translated && translated !== key ? translated : list.name;
  }

  getPriceListLabelById(priceListId: number | null | undefined): string {
    if (!priceListId) return '';
    const list = this.priceLists.find(item => item.id === priceListId);
    return list ? this.getPriceListLabel(list) : '';
  }

  private async applyCustomerPricingProfile(customerId: number): Promise<void> {
    try {
      if (this.selectedPriceListId) {
        await firstValueFrom(
          await this.pricingService.assignCustomerPriceList(customerId, this.selectedPriceListId)
        );
      } else {
        await firstValueFrom(await this.pricingService.clearCustomerPriceList(customerId));
      }
    } catch (error) {
      console.error('Error applying pricing profile:', error);
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('error_applying_pricing_profile'),
        life: 3000
      });
    }
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

  openCustomerDetails(customer: Customer) {
    if (!this.canReadHistory) return;
    this.router.navigate(['/sales/customers', customer.customerId]);
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

  async exportPdf() {
    if (this.isExporting) {
      return; // Prevent multiple simultaneous exports
    }

    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      
      // Show initial loading message
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('exporting'),
        detail: this.translate.instant('exporting_pdf_please_wait') || 'Exporting PDF, please wait...',
        life: 3000
      });

      // Load token and get organization's default locale
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';
      
      // Build translated export columns based on organization's default locale
      // Exclude customerId, customerType, firstName, lastName, companyName (we'll use Name instead)
      const translationKeyMap: { [key: string]: string } = {
        'Name': 'customer_name',
        'email': 'customer_email',
        'country': 'customer_country',
        'city': 'customer_city',
        'address': 'customer_address',
        'zip': 'customer_zip',
        'phoneNumber': 'customer_phone_number'
      };
      
      // Define export columns explicitly (excluding IDs and customerType)
      const exportColumns: ExportColumn[] = [
        { title: this.translate.instant('customer_name'), dataKey: 'Name' },
        { title: this.translate.instant('customer_email'), dataKey: 'email' },
        { title: this.translate.instant('customer_country'), dataKey: 'country' },
        { title: this.translate.instant('customer_city'), dataKey: 'city' },
        { title: this.translate.instant('customer_address'), dataKey: 'address' },
        { title: this.translate.instant('customer_zip'), dataKey: 'zip' },
        { title: this.translate.instant('customer_phone_number'), dataKey: 'phoneNumber' }
      ];
      
      const translatedExportColumns: ExportColumn[] = exportColumns;
      
      // Get translated title for PDF
      const pdfTitle = this.translate.instant('customers_menu_title') || this.translate.instant('customers');
      
      // Prepare customers for export with formatted fields
      const exportData = this.customers.map(customer => {
        const exportItem: any = {};
        
        // Create Name field: Company name for Company, firstname + lastname for Particular
        if (customer.customerType === 'Company') {
          exportItem.Name = customer.companyName || 'N/A';
        } else {
          // Particular customer
          const firstName = customer.firstName || '';
          const lastName = customer.lastName || '';
          exportItem.Name = (firstName + ' ' + lastName).trim() || 'N/A';
        }
        
        // Add other fields
        exportItem.email = customer.email || 'N/A';
        exportItem.country = customer.country || 'N/A';
        exportItem.city = customer.city || 'N/A';
        exportItem.address = customer.address || 'N/A';
        exportItem.zip = customer.zip || 'N/A';
        exportItem.phoneNumber = customer.phoneNumber || 'N/A';
        
        return exportItem;
      });
      
      // Export with translated headers and title
      this.reportingService.exportPdf(translatedExportColumns, exportData, 'customers', pdfTitle);
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${this.customers.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting customers PDF:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_exporting') || 'Error exporting PDF',
        life: 5000
      });
    } finally {
      this.isExporting = false;
      this.exportProgress = '';
    }
  }

  async exportExcel() {
    if (this.isExporting) {
      return; // Prevent multiple simultaneous exports
    }

    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      
      // Show initial loading message
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('exporting'),
        detail: this.translate.instant('exporting_excel_please_wait') || 'Exporting Excel, please wait...',
        life: 3000
      });

      // Load token and get organization's default locale
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';
      
      // Map column field names to translation keys
      const translationKeyMap: { [key: string]: string } = {
        'Name': 'customer_name',
        'email': 'customer_email',
        'country': 'customer_country',
        'city': 'customer_city',
        'address': 'customer_address',
        'zip': 'customer_zip',
        'phoneNumber': 'customer_phone_number'
      };
      
      // Prepare customers for export with formatted fields
      const modifiedCustomers = this.customers.map(customer => {
        const modifiedCustomer: any = {};
        
        // Create Name field: Company name for Company, firstname + lastname for Particular
        if (customer.customerType === 'Company') {
          modifiedCustomer.Name = customer.companyName || 'N/A';
        } else {
          // Particular customer
          const firstName = customer.firstName || '';
          const lastName = customer.lastName || '';
          modifiedCustomer.Name = (firstName + ' ' + lastName).trim() || 'N/A';
        }
        
        // Add other fields
        modifiedCustomer.email = customer.email || 'N/A';
        modifiedCustomer.country = customer.country || 'N/A';
        modifiedCustomer.city = customer.city || 'N/A';
        modifiedCustomer.address = customer.address || 'N/A';
        modifiedCustomer.zip = customer.zip || 'N/A';
        modifiedCustomer.phoneNumber = customer.phoneNumber || 'N/A';

        return modifiedCustomer;
      });

      // Create a translated version of the data with translated headers
      // For Excel, we need to create objects with translated keys
      const translatedCustomers = modifiedCustomers.map(customer => {
        const translated: any = {};
        Object.keys(customer).forEach(field => {
          const translationKey = translationKeyMap[field] || field;
          const translatedHeader = this.translate.instant(translationKey);
          translated[translatedHeader] = customer[field];
        });
        return translated;
      });

      // Now, export the translated array to Excel
      this.reportingService.exportExcel(translatedCustomers, 'customers');
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${this.customers.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting customers Excel:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_exporting') || 'Error exporting Excel',
        life: 5000
      });
    } finally {
      this.isExporting = false;
      this.exportProgress = '';
    }
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
