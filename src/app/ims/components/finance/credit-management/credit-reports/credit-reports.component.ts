import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { CustomerCreditService } from 'src/app/services/customer-credit.service';
import { CustomerCreditAccount } from 'src/app/models/customer-credit-account';
import { CustomerCreditTransaction } from 'src/app/models/customer-credit-transaction';
import { CreditAging } from 'src/app/models/credit-aging';
import { CreditInfo } from 'src/app/models/credit-info';
import { CustomerService } from 'src/app/services/customer.service';
import { Customer } from 'src/app/models/customer';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BRAND_AGING_CHART } from 'src/app/utils/brand-colors';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

@Component({
  selector: 'app-credit-reports',
  templateUrl: './credit-reports.component.html',
  styleUrls: ['./credit-reports.component.css', '../../finance.component.css'],
  providers: [MessageService]
})
export class CreditReportsComponent implements OnInit {
  readonly TablePageSizeKeys = TablePageSizeKeys;
  readonly creditReportPageOptions = [10, 20, 50] as const;

  isLoading: boolean = true;
  currency: string = 'USD';
  
  // Reports Data
  outstandingCreditAccounts: CustomerCreditAccount[] = [];
  overLimitAccounts: CustomerCreditAccount[] = [];
  creditAging: CreditAging | null = null;
  
  // Selected Customer for Aging Report
  selectedCustomerId: number | null = null;
  customers: any[] = [];
  
  // ⚠️ NEW: Outstanding Balance Aging Report
  selectedCustomerForOutstanding: Customer | null = null;
  outstandingAgingInfo: CreditInfo | null = null;
  outstandingAgingChartData: any;
  allCustomers: Customer[] = [];
  
  // Permissions
  isAdmin: boolean = false;
  canViewReports: boolean = false;
  
  // Chart Data
  agingChartData: any;
  agingChartOptions: any;

  constructor(
    private creditService: CustomerCreditService,
    private messageService: MessageService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private router: Router,
    private customerService: CustomerService,
    public pageSizeService: TablePageSizeService
  ) {}

  async ngOnInit() {
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.initChartOptions();
    });

    await this.checkPermissions();
    if (!this.canViewReports) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('access_denied'),
        life: 3000
      });
      this.router.navigate(['/']);
      return;
    }
    
    await this.loadReports();
    this.isLoading = false;
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    const roles = await this.keycloakService.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
    this.canViewReports = this.isAdmin || roles.includes('ACCOUNTANT') || roles.includes('AUDITOR');
  }

  async loadReports() {
    try {
      this.creditService.loadToken();
      
      // Load outstanding credit
      const outstanding$ = await this.creditService.getOutstandingCredit();
      this.outstandingCreditAccounts = await firstValueFrom(outstanding$);
      
      // Load over limit accounts (if admin)
      if (this.isAdmin) {
        try {
          const overLimit$ = await this.creditService.getOverLimitAccounts();
          this.overLimitAccounts = await firstValueFrom(overLimit$);
        } catch (error) {
          console.error('Error loading over limit accounts:', error);
          this.overLimitAccounts = [];
        }
      }
      
      // Load all accounts to populate customer list
      const allAccounts$ = await this.creditService.getAllCreditAccounts();
      const allAccounts = await firstValueFrom(allAccounts$);
      this.customers = allAccounts
        .filter(acc => acc.customer)
        .map(acc => ({
          label: this.getCustomerDisplayName(acc),
          value: acc.customer?.customerId
        }));
      
      // ⚠️ NEW: Load all customers for outstanding balance aging report
      try {
        this.customerService.loadToken();
        const customers$ = this.customerService.getCustomers();
        const response = await firstValueFrom(customers$);
        this.allCustomers = (response as Customer[]) || [];
      } catch (error) {
        console.error('Error loading customers:', error);
        this.allCustomers = [];
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_reports'),
        life: 3000
      });
    }
  }

  async loadCreditAging() {
    if (!this.selectedCustomerId) {
      this.creditAging = null;
      this.updateAgingChart();
      return;
    }

    try {
      this.creditService.loadToken();
      const aging$ = await this.creditService.getCreditAging(this.selectedCustomerId);
      this.creditAging = await firstValueFrom(aging$);
      this.updateAgingChart();
    } catch (error) {
      console.error('Error loading credit aging:', error);
      this.creditAging = null;
      this.updateAgingChart();
    }
  }

  updateAgingChart() {
    if (!this.creditAging) {
      this.agingChartData = null;
      return;
    }

    this.agingChartData = {
      labels: [
        this.translate.instant('aging_0_30_days'),
        this.translate.instant('aging_31_60_days'),
        this.translate.instant('aging_61_90_days'),
        this.translate.instant('aging_90_plus_days')
      ],
      datasets: [{
        label: this.translate.instant('credit_aging'),
        data: [
          this.creditAging['0-30'] || 0,
          this.creditAging['31-60'] || 0,
          this.creditAging['61-90'] || 0,
          this.creditAging['90+'] || 0
        ],
        backgroundColor: [...BRAND_AGING_CHART.background],
        hoverBackgroundColor: [...BRAND_AGING_CHART.hover]
      }]
    };
  }

  initChartOptions() {
    this.agingChartOptions = {
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              return `${context.label}: ${this.currency} ${context.parsed.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: any) => {
              return this.currency + ' ' + value.toFixed(2);
            }
          }
        }
      }
    };
  }

  exportOutstandingCredit() {
    // TODO: Implement export functionality
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: this.translate.instant('export_functionality_coming_soon'),
      life: 3000
    });
  }

  exportOverLimit() {
    // TODO: Implement export functionality
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: this.translate.instant('export_functionality_coming_soon'),
      life: 3000
    });
  }

  navigateToCustomerCredit(customerId?: number) {
    if (customerId) {
      this.router.navigate(['/finance/credit-management/customer', customerId]);
    }
  }

  getCustomerDisplayName(account: CustomerCreditAccount): string {
    if (!account.customer) return 'N/A';
    if (account.customer.customerType === 'Company' && account.customer.companyName) {
      return account.customer.companyName;
    }
    const firstName = account.customer.firstName || '';
    const lastName = account.customer.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'N/A';
  }

  getStatusSeverity(status?: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'SUSPENDED':
        return 'warning';
      case 'CLOSED':
        return 'danger';
      case 'PENDING':
        return 'info';
      case 'EXPIRED':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  getOverLimitAmount(account: CustomerCreditAccount): number {
    if (!account.creditLimit || account.creditLimit === 0) return 0;
    const balance = account.creditBalance || 0;
    return Math.max(0, balance - account.creditLimit);
  }

  // ⚠️ NEW: Outstanding Balance Aging Report Methods
  async loadOutstandingBalanceAging() {
    if (!this.selectedCustomerForOutstanding?.customerId) {
      this.outstandingAgingInfo = null;
      this.updateOutstandingAgingChart();
      return;
    }

    try {
      this.creditService.loadToken();
      const creditInfo$ = await this.creditService.getCreditInfo(this.selectedCustomerForOutstanding.customerId);
      this.outstandingAgingInfo = await firstValueFrom(creditInfo$);
      this.updateOutstandingAgingChart();
    } catch (error) {
      console.error('Error loading outstanding balance aging:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_outstanding_aging'),
        life: 3000
      });
      this.outstandingAgingInfo = null;
      this.updateOutstandingAgingChart();
    }
  }

  updateOutstandingAgingChart() {
    if (!this.outstandingAgingInfo?.outstandingAging) {
      this.outstandingAgingChartData = null;
      return;
    }

    const aging = this.outstandingAgingInfo.outstandingAging;
    const total = (aging['0-30'] || 0) + (aging['31-60'] || 0) + (aging['61-90'] || 0) + (aging['90+'] || 0);

    this.outstandingAgingChartData = {
      labels: [
        this.translate.instant('aging_0_30_days'),
        this.translate.instant('aging_31_60_days'),
        this.translate.instant('aging_61_90_days'),
        this.translate.instant('aging_90_plus_days')
      ],
      datasets: [{
        label: this.translate.instant('outstanding_balance_aging'),
        data: [
          aging['0-30'] || 0,
          aging['31-60'] || 0,
          aging['61-90'] || 0,
          aging['90+'] || 0
        ],
        backgroundColor: [...BRAND_AGING_CHART.background],
        hoverBackgroundColor: [...BRAND_AGING_CHART.hover]
      }]
    };
  }

  getOutstandingAgingPercentage(bucket: '0-30' | '31-60' | '61-90' | '90+'): number {
    if (!this.outstandingAgingInfo?.outstandingAging) return 0;
    const aging = this.outstandingAgingInfo.outstandingAging;
    const total = (aging['0-30'] || 0) + (aging['31-60'] || 0) + (aging['61-90'] || 0) + (aging['90+'] || 0);
    if (total === 0) return 0;
    return ((aging[bucket] || 0) / total) * 100;
  }

  getTotalOutstandingAging(): number {
    if (!this.outstandingAgingInfo?.outstandingAging) return 0;
    const aging = this.outstandingAgingInfo.outstandingAging;
    return (aging['0-30'] || 0) + (aging['31-60'] || 0) + (aging['61-90'] || 0) + (aging['90+'] || 0);
  }

  getCustomerDisplayNameForDropdown(customer: Customer): string {
    if (customer.customerType === 'Company' && customer.companyName) {
      return customer.companyName;
    }
    const firstName = customer.firstName || '';
    const lastName = customer.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'N/A';
  }
}

