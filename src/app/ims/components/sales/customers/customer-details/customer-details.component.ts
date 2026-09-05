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
import { CustomerCreditService } from 'src/app/services/customer-credit.service';
import { CustomerCreditAccount } from 'src/app/models/customer-credit-account';
import { CreditInfo } from 'src/app/models/credit-info';
import { PricingService } from 'src/app/services/pricing.service';
import { CustomerPriceOverrideDTO, PriceListDTO } from 'src/app/models/pricing';
import { Product } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';
import { CustomerFormDialogComponent, CustomerFormDialogConfig, CustomerFormDialogData } from '../customer-form-dialog/customer-form-dialog.component';
import { Location } from '@angular/common';
import { BRAND_COLORS, BRAND_ORDER_STATUS_CHART } from 'src/app/utils/brand-colors';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

@Component({
  templateUrl: './customer-details.component.html',
  styleUrls: ['./customer-details.component.css', '../../sales.component.css'],
  providers: [MessageService]
})
export class CustomerDetailsComponent implements OnInit {
  TablePageSizeKeys = TablePageSizeKeys;

  customerId!: number;
  customer: Customer | null = null;
  customerOrders: Order[] = [];
  customerReturns: OrderReturn[] = [];
  customerPayments: Payment[] = [];
  creditAccount: CustomerCreditAccount | null = null;
  creditInfo: CreditInfo | null = null;
  priceOverrides: CustomerPriceOverrideDTO[] = [];
  isLoadingOverrides: boolean = false;
  overrideDialog: boolean = false;
  overrideForm: CustomerPriceOverrideDTO | null = null;
  selectedOverrideProduct: Product | null = null;
  productSuggestions: Product[] = [];
  productSuggestionsLoading: boolean = false;
  overrideSubmitted: boolean = false;
  isSavingOverride: boolean = false;

  isLoading: boolean = true;
  currency: string = 'USD';
  
  // Expose Math and isFinite for template use
  Math = Math;
  isFinite = isFinite;

  orderStatusChartData: any;
  monthlySpendingChartData: any;
  chartOptions: any;
  barChartOptions: any;

  canEditCustomer: boolean = false;
  canManagePricingProfile: boolean = false;
  Ressource: string = 'CUSTOMERS';

  customerDialog: boolean = false;
  submitted: boolean = false;
  selectedCountry: any = null;
  states: any = null;
  countries: any;

  // Follow-up report download state
  followupIncludeItems: boolean = false;
  isDownloadingFollowupCsv: boolean = false;
  isDownloadingFollowupExcel: boolean = false;
  isDownloadingFollowupPdf: boolean = false;

  // Dialog configuration for reusable component
  customerDialogConfig: CustomerFormDialogConfig = {
    visible: false,
    mode: 'edit',
    customer: {},
    selectedPriceListId: null,
    isLoadingPriceLists: false,
    canManagePricingProfile: false
  };

  // Pricing related properties
  priceLists: PriceListDTO[] = [];
  selectedPriceListId: number | null = null;
  isLoadingPriceLists: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private messageService: MessageService,
    private customerService: CustomerService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private locationService: LocationService,
    private cdr: ChangeDetectorRef,
    private creditService: CustomerCreditService,
    private pricingService: PricingService,
    private productService: ProductService,
    public pageSizeService: TablePageSizeService
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
      await this.loadPriceLists();
      await this.loadCustomer();
      await this.loadCustomerData();
      await this.loadCreditAccount();
      await this.loadCreditInfo();
      await this.loadPriceOverrides();
      this.initChartOptions();
      this.isLoading = false;
    });
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canEditCustomer = this.permissionService.canUpdate(this.Ressource);
    const roles = await this.keycloakService.getUserRoles();
    this.canManagePricingProfile = roles.includes('ADMIN');
  }

  async loadCustomer() {
    try {
      this.customerService.loadToken();

      if (!this.customerId || Number.isNaN(this.customerId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('customer_not_found'),
          life: 3000
        });
        this.router.navigate(['/sales/customers']);
        return;
      }

      try {
        const customer = await firstValueFrom(this.customerService.getCustomer(this.customerId));
        this.customer = (customer as Customer) || null;
      } catch {
        const response = await firstValueFrom(this.customerService.getCustomers());
        const customers = this.extractCustomers(response);
        this.customer = customers.find(
          (c: Customer) => Number(c.customerId) === this.customerId
        ) || null;
      }

      if (!this.customer) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('customer_not_found'),
          life: 3000
        });
        this.router.navigate(['/sales/customers']);
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_customer'),
        life: 3000
      });
      this.router.navigate(['/sales/customers']);
    }
  }

  private extractCustomers(response: any): Customer[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (Array.isArray(response?.content)) {
      return response.content;
    }
    return [];
  }

  async loadPriceLists(): Promise<void> {
    if (!this.canManagePricingProfile) {
      this.priceLists = [];
      this.isLoadingPriceLists = false;
      return;
    }
    try {
      this.isLoadingPriceLists = true;
      const lists = await firstValueFrom(await this.pricingService.getPriceLists());
      this.priceLists = lists || [];
    } catch (error) {
      console.error('Error loading price lists:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_price_lists'),
        life: 3000
      });
    } finally {
      this.isLoadingPriceLists = false;
    }
  }

  async loadCustomerData(): Promise<void> {
    await this.getCustomerOrders(this.customerId);
    await this.getCustomerReturns(this.customerId);
    await this.getCustomerPayments(this.customerId);
    this.prepareCharts();
  }

  async loadPriceOverrides(): Promise<void> {
    if (!this.canManagePricingProfile) {
      this.priceOverrides = [];
      this.isLoadingOverrides = false;
      return;
    }
    this.isLoadingOverrides = true;
    try {
      const overrides = await firstValueFrom(
        await this.pricingService.getCustomerOverrides(this.customerId)
      );
      this.priceOverrides = Array.isArray(overrides) ? overrides : [];

      // Ensure productName is populated for display, even if backend doesn't send it
      const overridesNeedingName = this.priceOverrides.filter(
        o => !!o.productId && !o.productName
      );

      if (overridesNeedingName.length > 0) {
        try {
          this.productService.loadToken();
          const uniqueProductIds = Array.from(
            new Set(overridesNeedingName.map(o => o.productId))
          );

          const productMap = new Map<number, string>();
          await Promise.all(
            uniqueProductIds.map(async (id) => {
              try {
                const product: any = await firstValueFrom(this.productService.getProduct(id));
                if (product && product.name) {
                  productMap.set(id, product.name);
                }
              } catch {
                // Ignore individual product load errors
              }
            })
          );

          this.priceOverrides = this.priceOverrides.map(o => ({
            ...o,
            productName: o.productName || (o.productId && productMap.get(o.productId)) || o.productName
          }));
        } catch (e) {
          console.error('Error enriching price overrides with product names:', e);
        }
      }
    } catch (error) {
      console.error('Error loading price overrides:', error);
      this.priceOverrides = [];
    } finally {
      this.isLoadingOverrides = false;
    }
  }

  openOverrideDialog(override?: CustomerPriceOverrideDTO): void {
    if (!this.customerId) return;
    this.overrideSubmitted = false;
    if (override) {
      this.overrideForm = { ...override };
      this.selectedOverrideProduct = override.productId
        ? ({ productId: override.productId, name: override.productName } as Product)
        : null;
    } else {
      this.overrideForm = {
        customerId: this.customerId,
        productId: 0,
        unitPrice: 0,
        active: true,
        validFrom: null,
        validTo: null,
        notes: null
      };
      this.selectedOverrideProduct = null;
    }
    this.overrideDialog = true;
  }

  async saveOverride(): Promise<void> {
    this.overrideSubmitted = true;

    if (!this.overrideForm || !this.overrideForm.productId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('required_field'),
        detail: `${this.translate.instant('product')} ${this.translate.instant('is_required_label')}`,
        life: 3000
      });
      return;
    }

    if (!this.overrideForm.unitPrice || this.overrideForm.unitPrice <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('required_field'),
        detail: `${this.translate.instant('unit_price')} ${this.translate.instant('is_required_label')}`,
        life: 3000
      });
      return;
    }

    try {
      this.isSavingOverride = true;
      await firstValueFrom(
        await this.pricingService.upsertCustomerOverride(this.customerId, this.overrideForm)
      );
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('price_override_saved'),
        life: 3000
      });
      this.overrideDialog = false;
      await this.loadPriceOverrides();
    } catch (error) {
      console.error('Error saving override:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_saving_price_override'),
        life: 3000
      });
    } finally {
      this.isSavingOverride = false;
    }
  }

  async deactivateOverride(override: CustomerPriceOverrideDTO): Promise<void> {
    if (!override.id) return;
    try {
      await firstValueFrom(
        await this.pricingService.deactivateCustomerOverride(this.customerId, override.id)
      );
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('price_override_deactivated'),
        life: 3000
      });
      await this.loadPriceOverrides();
    } catch (error) {
      console.error('Error deactivating override:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_deactivating_price_override'),
        life: 3000
      });
    }
  }

  async searchProducts(event: any): Promise<void> {
    const query = event.query || '';
    this.productSuggestionsLoading = true;
    try {
      this.productService.loadToken();
      const response = await firstValueFrom(this.productService.searchProductsForOrder(query));
      this.productSuggestions = Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Error searching products:', error);
      this.productSuggestions = [];
    } finally {
      this.productSuggestionsLoading = false;
    }
  }

  onOverrideProductSelect(product: Product): void {
    if (!this.overrideForm) return;
    this.overrideForm.productId = product.productId;
    this.overrideForm.productName = product.name;
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

  async loadCreditAccount() {
    try {
      this.creditService.loadToken();
      const account$ = await this.creditService.getCreditAccount(this.customerId);
      const account = await firstValueFrom(account$);
      this.creditAccount = account;
    } catch (error: any) {
      // Account might not exist yet, that's okay
      if (error?.status !== 404) {
        console.error('Error loading credit account:', error);
      }
    }
  }

  creditStatusUpdating = false;

  /**
   * A credit account is usable only while ACTIVE; every other status blocks credit sales for this
   * customer. Treated as active when the status is absent so a customer whose account predates
   * this screen is not shown as suspended when it is not.
   */
  isCreditAccountActive(): boolean {
    const status = this.creditInfo?.status;
    return !status || status === 'ACTIVE';
  }

  async toggleCreditAccountStatus(): Promise<void> {
    if (this.creditStatusUpdating || !this.customerId) {
      return;
    }
    const suspending = this.isCreditAccountActive();
    this.creditStatusUpdating = true;
    try {
      const update$ = await this.creditService.updateCreditStatus(
        this.customerId, suspending ? 'SUSPENDED' : 'ACTIVE');
      await firstValueFrom(update$);
      // Re-read rather than patching locally: suspending changes what the backend reports as
      // available, and the rest of this card is drawn from those figures.
      await this.loadCreditInfo();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant(
          suspending ? 'credit_account_suspended' : 'credit_account_reactivated'),
        life: 3000,
      });
    } catch (error) {
      console.error('Failed to update the credit account status:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('credit_account_status_update_failed'),
        life: 4000,
      });
    } finally {
      this.creditStatusUpdating = false;
    }
  }

  async loadCreditInfo() {
    try {
      this.creditService.loadToken();
      const creditInfo$ = await this.creditService.getCreditInfo(this.customerId);
      this.creditInfo = await firstValueFrom(creditInfo$);
      
      if (this.creditInfo) {
        if (this.isInvalidValue(this.creditInfo.netBalance)) {
          this.creditInfo.netBalance = null as any;
        }
        if (this.isInvalidValue(this.creditInfo.availableCreditLimit)) {
          this.creditInfo.availableCreditLimit = null as any;
        }
        if (this.isInvalidValue(this.creditInfo.outstandingBalance)) {
          this.creditInfo.outstandingBalance = null as any;
        }
        if (this.isInvalidValue(this.creditInfo.overdueBalance)) {
          this.creditInfo.overdueBalance = null as any;
        }
      }
    } catch (error: any) {
      // Credit info might not be available, that's okay
      if (error?.status !== 404) {
        console.error('Error loading credit info:', error);
      }
      this.creditInfo = null;
    }
  }

  private isInvalidValue(value: any): boolean {
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

  navigateToCreditManagement() {
    this.router.navigate(['/finance/credit-management/customer', this.customerId]);
  }

  prepareCharts(): void {
    const statusCounts = this.countByStatus(this.customerOrders, 'orderStatus');
    this.orderStatusChartData = {
      labels: Object.keys(statusCounts).map(key =>
        this.translate.instant('order_status_' + key.toLowerCase())
      ),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [...BRAND_ORDER_STATUS_CHART.background],
        hoverBackgroundColor: [...BRAND_ORDER_STATUS_CHART.hover]
      }]
    };

    const monthlyData = this.groupByMonth(this.customerOrders);
    this.monthlySpendingChartData = {
      labels: Object.keys(monthlyData),
      datasets: [{
        label: this.translate.instant('monthly_spending'),
        data: Object.values(monthlyData),
        backgroundColor: BRAND_COLORS.cyan
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

  getSafeNetBalance(): number | null {
    if (!this.creditInfo || this.creditInfo.netBalance === undefined || this.creditInfo.netBalance === null) {
      return null;
    }
    
    const value = this.creditInfo.netBalance;
    
    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Check for invalid values (Infinity, NaN, or extremely large numbers like 1.80E+308)
    // Number.MAX_VALUE is approximately 1.7976931348623157e+308
    // Values >= 1e15 or close to MAX_VALUE are considered invalid
    const absValue = Math.abs(numValue);
    if (!isFinite(numValue) || isNaN(numValue) || 
        absValue > 1e15 || 
        absValue >= Number.MAX_VALUE * 0.9 || // Catch values close to MAX_VALUE
        String(value).toUpperCase().includes('E+')) { // Catch scientific notation strings
      // If value is invalid, sanitize it in the stored data and return null
      if (this.creditInfo) {
        this.creditInfo.netBalance = null as any;
      }
      return null;
    }
    
    return numValue;
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
    this.selectedPriceListId = (this.customer as any)?.priceList?.priceListId ?? (this.customer as any)?.priceList?.id ?? (this.customer as any)?.priceListId ?? null;
    this.customerDialogConfig = {
      visible: true,
      mode: 'edit',
      customer: { ...this.customer },
      selectedPriceListId: this.selectedPriceListId,
      isLoadingPriceLists: this.isLoadingPriceLists,
      canManagePricingProfile: this.canManagePricingProfile
    };
    if (this.customer.country) {
      this.onSelectedCountry(this.customer.country);
    }
  }

  hideDialog() {
    this.customerDialogConfig.visible = false;
    this.submitted = false;
    this.selectedCountry = {};
    this.loadCustomer();
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

  private async applyCustomerPricingProfile(customerId: number): Promise<void> {
    if (!this.canManagePricingProfile) {
      return;
    }
    try {
      if (this.selectedPriceListId) {
        await firstValueFrom(
          await this.pricingService.assignCustomerPriceList(customerId, this.selectedPriceListId)
        );
      }
    } catch (error) {
      console.error('Error applying customer pricing profile:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_updating_customer_pricing_profile'),
        life: 3000
      });
    }
  }

  async updateCustomer(id: any, customer: any): Promise<any> {
    this.customerService.updateCustomer(id, customer)
      .subscribe({
        next: async (response: any) => {
          // Apply pricing profile after successful customer update
          await this.applyCustomerPricingProfile(id);

          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('customer_updated'),
            life: 3000
          });
          this.customerDialogConfig.visible = false;
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
          const savedCustomerId = response?.customerId;

          // Apply pricing profile after successful customer creation
          if (savedCustomerId) {
            await this.applyCustomerPricingProfile(savedCustomerId);
          }

          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('customer_added'),
            life: 3000
          });
          this.customerDialogConfig.visible = false;
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
    this.location.back();
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

  getPriceListLabel(list: PriceListDTO | null | undefined): string {
    if (!list?.name) return '';
    const key = `price_list_${list.name.toLowerCase()}`;
    const translated = this.translate.instant(key);
    return translated && translated !== key ? translated : list.name;
  }

  // Customer follow-up report downloads (CSV / Excel / PDF)
  async downloadCustomerFollowupReport(format: 'csv' | 'excel' | 'pdf'): Promise<void> {
    if (!this.customerId) {
      return;
    }

    const loadingKey =
      format === 'csv'
        ? 'isDownloadingFollowupCsv'
        : format === 'excel'
        ? 'isDownloadingFollowupExcel'
        : 'isDownloadingFollowupPdf';

    (this as any)[loadingKey] = true;

    try {
      const response$ = await this.creditService.downloadCustomerFollowupReport(
        this.customerId,
        format,
        this.followupIncludeItems
      );
      const response: any = await firstValueFrom(response$);
      const blob: Blob = response?.body;

      if (!blob) {
        throw new Error('Empty follow-up report response');
      }

      const header =
        response?.headers?.get?.('Content-Disposition') ||
        response?.headers?.get?.('content-disposition') ||
        response?.headers?.['Content-Disposition'] ||
        response?.headers?.['content-disposition'] ||
        null;

      const filename = this.extractFilenameFromContentDisposition(
        header,
        this.getDefaultFollowupFilename(format, this.customerId)
      );

      this.triggerBrowserDownload(blob, filename);

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('report_download_started'),
        life: 3000
      });
    } catch (error) {
      console.error('Error downloading customer follow-up report:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_downloading_followup_report'),
        life: 3000
      });
    } finally {
      (this as any)[loadingKey] = false;
    }
  }

  private extractFilenameFromContentDisposition(
    header: string | null | undefined,
    fallback: string
  ): string {
    if (!header) {
      return fallback;
    }

    // Try RFC5987 and simple filename parsing
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(header);
    const encoded = match?.[1];
    const simple = match?.[2];

    try {
      if (encoded) {
        return decodeURIComponent(encoded);
      }
      if (simple) {
        return simple;
      }
    } catch {
      // ignore parsing errors and fall back
    }

    return fallback;
  }

  private getDefaultFollowupFilename(
    format: 'csv' | 'excel' | 'pdf',
    customerId: number
  ): string {
    const ext = format === 'csv' ? 'csv' : format === 'excel' ? 'xlsx' : 'pdf';
    return `customer_${customerId}_followup_report.${ext}`;
  }

  private triggerBrowserDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

