import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { CustomerCreditService } from 'src/app/services/customer-credit.service';
import { CustomerCreditAccount } from 'src/app/models/customer-credit-account';
import { CustomerCreditTransaction } from 'src/app/models/customer-credit-transaction';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-credit-management-dashboard',
  templateUrl: './credit-management-dashboard.component.html',
  styleUrls: ['./credit-management-dashboard.component.css', '../../finance.component.css'],
  providers: [MessageService]
})
export class CreditManagementDashboardComponent implements OnInit {
  isLoading: boolean = true;
  currency: string = 'USD';
  
  // Summary Statistics
  totalCreditIssued: number = 0;
  totalCreditUsed: number = 0;
  outstandingCreditBalance: number = 0;
  customersWithCredit: number = 0;
  customersOverLimit: number = 0;
  
  // Data
  outstandingCreditAccounts: CustomerCreditAccount[] = [];
  overLimitAccounts: CustomerCreditAccount[] = [];
  recentTransactions: CustomerCreditTransaction[] = [];
  
  // Permissions
  isAdmin: boolean = false;
  canManageCredit: boolean = false;
  
  // Filters
  selectedCustomer: any = null;
  customers: any[] = [];
  transactionTypeFilter: string | null = null;
  dateRange: Date[] = [];

  constructor(
    private creditService: CustomerCreditService,
    private messageService: MessageService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    await this.checkPermissions();
    if (!this.canManageCredit) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('access_denied'),
        life: 3000
      });
      this.router.navigate(['/']);
      return;
    }
    
    await this.loadDashboardData();
    this.isLoading = false;
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    const roles = await this.keycloakService.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
    this.canManageCredit = this.isAdmin; // Only ADMIN can access dashboard
  }

  async loadDashboardData() {
    try {
      this.creditService.loadToken();
      
      // Load all credit accounts
      const accounts$ = await this.creditService.getAllCreditAccounts();
      const allAccounts = await firstValueFrom(accounts$);
      
      // Calculate summary statistics
      this.totalCreditIssued = allAccounts.reduce((sum, acc) => sum + (acc.totalCreditIssued || 0), 0);
      this.totalCreditUsed = allAccounts.reduce((sum, acc) => sum + (acc.totalCreditUsed || 0), 0);
      this.outstandingCreditBalance = allAccounts.reduce((sum, acc) => sum + (acc.creditBalance || 0), 0);
      this.customersWithCredit = allAccounts.filter(acc => (acc.creditBalance || 0) > 0).length;
      
      // Load outstanding credit accounts
      const outstanding$ = await this.creditService.getOutstandingCredit();
      this.outstandingCreditAccounts = await firstValueFrom(outstanding$);
      
      // Load over limit accounts (if admin)
      if (this.isAdmin) {
        try {
          const overLimit$ = await this.creditService.getOverLimitAccounts();
          this.overLimitAccounts = await firstValueFrom(overLimit$);
          this.customersOverLimit = this.overLimitAccounts.length;
        } catch (error) {
          console.error('Error loading over limit accounts:', error);
          this.overLimitAccounts = [];
        }
      }
      
      // Load recent transactions (from first customer with transactions)
      if (this.outstandingCreditAccounts.length > 0) {
        const firstCustomerId = this.outstandingCreditAccounts[0].customer?.customerId;
        if (firstCustomerId) {
          try {
            const transactions$ = await this.creditService.getCreditTransactionsPaged(
              firstCustomerId,
              0,
              10
            );
            const page = await firstValueFrom(transactions$);
            this.recentTransactions = page.content || [];
          } catch (error) {
            console.error('Error loading recent transactions:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_dashboard_data'),
        life: 3000
      });
    }
  }

  async processExpiredCredits() {
    if (!this.isAdmin) return;
    
    try {
      this.creditService.loadToken();
      const transactions$ = await this.creditService.processExpiredCredits();
      const processed = await firstValueFrom(transactions$);
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('expired_credits_processed', { count: processed.length }),
        life: 3000
      });
      
      await this.loadDashboardData();
    } catch (error: any) {
      console.error('Error processing expired credits:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_processing_expired_credits'),
        life: 3000
      });
    }
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
}

