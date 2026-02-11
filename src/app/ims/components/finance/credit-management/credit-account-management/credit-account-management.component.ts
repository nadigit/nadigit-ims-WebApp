import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { CustomerCreditService } from 'src/app/services/customer-credit.service';
import { CustomerCreditAccount } from 'src/app/models/customer-credit-account';
import { CustomerCreditTransaction, CreditTransactionType } from 'src/app/models/customer-credit-transaction';
import { CustomerService } from 'src/app/services/customer.service';
import { Customer } from 'src/app/models/customer';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom } from 'rxjs';
import { CreditStatus } from 'src/app/models/customer-credit-account';
import { CreditInfo } from 'src/app/models/credit-info';
import { Location } from '@angular/common';

@Component({
  selector: 'app-credit-account-management',
  templateUrl: './credit-account-management.component.html',
  styleUrls: ['./credit-account-management.component.css', '../../finance.component.css'],
  providers: [MessageService]
})
export class CreditAccountManagementComponent implements OnInit {
  customerId!: number;
  customer: Customer | null = null;
  creditAccount: CustomerCreditAccount | null = null;
  creditInfo: CreditInfo | null = null; // ⚠️ NEW: Enhanced credit info with outstanding balances
  transactions: CustomerCreditTransaction[] = [];
  
  isLoading: boolean = true;
  currency: string = 'USD';
  
  // Modals
  issueCreditVisible: boolean = false;
  adjustCreditVisible: boolean = false;
  setLimitVisible: boolean = false;
  changeStatusVisible: boolean = false;
  
  // Status change
  newStatus: CreditStatus | null = null;
  statusOptions: { label: string; value: CreditStatus }[] = [];
  
  // Permissions
  isAdmin: boolean = false;
  canManageCredit: boolean = false;
  
  // Pagination
  currentPage: number = 0;
  pageSize: number = 20;
  totalRecords: number = 0;

  // Expose Math and isFinite for template use
  Math = Math;
  isFinite = isFinite;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private creditService: CustomerCreditService,
    private customerService: CustomerService,
    private messageService: MessageService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService
  ) {}

  async ngOnInit() {
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.initStatusOptions();
    });

    this.route.params.subscribe(async params => {
      this.customerId = +params['customerId'];
      if (!this.customerId || isNaN(this.customerId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_customer_id'),
          life: 3000
        });
        this.router.navigate(['/sales/customers']);
        return;
      }
      await this.checkPermissions();
      await this.loadCustomer();
      await this.loadCreditAccount();
      await this.loadCreditInfo(); // ⚠️ NEW: Load enhanced credit info
      await this.loadTransactions();
      this.isLoading = false;
    });
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    const roles = await this.keycloakService.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
    this.canManageCredit = this.isAdmin; // Only ADMIN can manage credit
  }

  initStatusOptions() {
    this.statusOptions = [
      { label: this.translate.instant('credit_status_active'), value: 'ACTIVE' },
      { label: this.translate.instant('credit_status_suspended'), value: 'SUSPENDED' },
      { label: this.translate.instant('credit_status_closed'), value: 'CLOSED' },
      { label: this.translate.instant('credit_status_pending'), value: 'PENDING' },
      { label: this.translate.instant('credit_status_expired'), value: 'EXPIRED' }
    ];
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
    }
  }

  async loadCreditAccount() {
    try {
      this.creditService.loadToken();
      const account$ = await this.creditService.getCreditAccount(this.customerId);
      const account = await firstValueFrom(account$);
      this.creditAccount = account;
    } catch (error: any) {
      console.error('Error loading credit account:', error);
      // Account might not exist yet, that's okay
      if (error?.status !== 404) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_credit_account'),
          life: 3000
        });
      }
    }
  }

  // ⚠️ NEW: Load enhanced credit info with outstanding balances
  async loadCreditInfo() {
    try {
      this.creditService.loadToken();
      const creditInfo$ = await this.creditService.getCreditInfo(this.customerId);
      this.creditInfo = await firstValueFrom(creditInfo$);
      
      // ⚠️ Sanitize invalid values (Infinity, NaN, or extremely large numbers)
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
      console.error('Error loading credit info:', error);
      // Credit info might not be available, that's okay
      if (error?.status !== 404) {
        console.warn('Could not load enhanced credit info');
      }
      this.creditInfo = null;
    }
  }

  // Helper method to check if a value is invalid
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

  async loadTransactions() {
    try {
      this.creditService.loadToken();
      const transactions$ = await this.creditService.getCreditTransactionsPaged(
        this.customerId,
        this.currentPage,
        this.pageSize
      );
      const page = await firstValueFrom(transactions$);
      this.transactions = page.content || [];
      this.totalRecords = page.totalElements || 0;
    } catch (error) {
      console.error('Error loading transactions:', error);
      this.transactions = [];
    }
  }

  onPageChange(event: any) {
    this.currentPage = event.page;
    this.pageSize = event.rows;
    this.loadTransactions();
  }

  openIssueCredit() {
    this.issueCreditVisible = true;
  }

  openAdjustCredit() {
    this.adjustCreditVisible = true;
  }

  openSetLimit() {
    this.setLimitVisible = true;
  }

  openChangeStatus() {
    if (this.creditAccount) {
      this.newStatus = this.creditAccount.status || null;
    }
    this.changeStatusVisible = true;
  }

  async onCreditIssued() {
    await this.loadCreditAccount();
    await this.loadCreditInfo(); // ⚠️ NEW: Refresh credit info
    await this.loadTransactions();
  }

  async onCreditAdjusted() {
    await this.loadCreditAccount();
    await this.loadCreditInfo(); // ⚠️ NEW: Refresh credit info
    await this.loadTransactions();
  }

  async onLimitSet() {
    await this.loadCreditAccount();
    await this.loadCreditInfo(); // ⚠️ NEW: Refresh credit info
  }

  async saveStatusChange() {
    if (!this.customerId || !this.newStatus) {
      return;
    }

    try {
      this.creditService.loadToken();
      const account$ = await this.creditService.updateCreditStatus(this.customerId, this.newStatus);
      const account = await firstValueFrom(account$);
      this.creditAccount = account;
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('credit_status_updated_successfully'),
        life: 3000
      });
      
      this.changeStatusVisible = false;
    } catch (error: any) {
      console.error('Error updating status:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_updating_status'),
        life: 3000
      });
    }
  }

  getTransactionTypeLabel(type?: CreditTransactionType): string {
    if (!type) return '';
    return this.translate.instant(`credit_transaction_type_${type.toLowerCase()}`);
  }

  getTransactionTypeSeverity(type?: CreditTransactionType): string {
    switch (type) {
      case 'CREDIT_ISSUED':
      case 'REFUND_ISSUED':
        return 'success';
      case 'CREDIT_USED':
      case 'CREDIT_EXPIRED':
        return 'danger';
      case 'CREDIT_ADJUSTMENT':
        return 'warning';
      case 'PAYMENT_APPLIED':
        return 'info';
      default:
        return 'secondary';
    }
  }

  goBack() {
    this.location.back();
  }

  getCustomerDisplayName(customer?: Customer | null): string {
    if (!customer) return '';
    if (customer.customerType === 'Company' && customer.companyName) {
      return customer.companyName;
    }
    const firstName = customer.firstName || '';
    const lastName = customer.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'N/A';
  }
}

