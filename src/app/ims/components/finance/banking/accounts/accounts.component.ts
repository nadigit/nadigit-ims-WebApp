import { Component, OnInit, ViewChild } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Bank } from 'src/app/models/bank';
import { BankAccount, AccountType } from 'src/app/models/bank-account';
import { BankTransaction } from 'src/app/models/bank-transaction';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';
import {
  TransactionFormDialogConfig,
  TransactionFormDialogData
} from '../transactions/transaction-form-dialog/transaction-form-dialog.component';

@Component({
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.css', '../../finance.component.css'],
  providers: [MessageService]
})
export class AccountsComponent implements OnInit {

  @ViewChild('dt') dt!: Table;

  Ressource: string = 'BANK_ACCOUNTS';

  accounts: BankAccount[] = [];
  account: BankAccount = {
    bank: {} as Bank,
    accountName: '',
    accountType: 'CHECKING',
    openingBalance: 0
  };
  selectedAccounts: BankAccount[] = [];

  accountDialog: boolean = false;
  deleteAccountDialog: boolean = false;
  deleteAccountsDialog: boolean = false;
  accountDetailsDialog: boolean = false;

  submitted: boolean = false;
  isLoading: boolean = true;
  isInitialLoad: boolean = true;

  cols: any[] = [];
  rowsPerPageOptions = [20, 50, 100];
  pageSize = 20;
  globalFilter: string = '';

  canAddAccount: boolean = false;
  canEditAccount: boolean = false;
  canDeleteAccount: boolean = false;
  canReadAccount: boolean = false;

  banks: Bank[] = [];
  accountTypes: { label: string, value: AccountType }[] = [];
  currency: string = 'USD';
  activeFilter: boolean | undefined = undefined;
  bankFilter: number | undefined = undefined;
  accountTypeFilter: AccountType | undefined = undefined;

  transactionDialogConfig: TransactionFormDialogConfig = {
    visible: false,
    transaction: {
      account: {} as BankAccount,
      type: 'DEPOSIT',
      amount: 0,
      transactionDate: new Date().toISOString().split('T')[0]
    },
    submitted: false
  };
  transactionAccount: BankAccount | null = null;

  constructor(
    private messageService: MessageService,
    private bankAccountService: BankAccountService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private router: Router,
    public pageSizeService: TablePageSizeService
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    this.pageSize = this.pageSizeService.initState(TablePageSizeKeys.bankingAccounts, this.rowsPerPageOptions, {
      pageSize: this.pageSize,
    });
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });
    await this.checkPermissions();
    this.setupColumns();
    this.setupAccountTypes();
    await this.loadBanks();
    await this.loadAccounts();
  }

  onTablePage(event: any): void {
    this.pageSizeService.applyPageEvent(TablePageSizeKeys.bankingAccounts, this.rowsPerPageOptions, event, this);
  }

  setupColumns() {
    this.cols = [
      { field: 'accountName', header: 'account_name' },
      { field: 'bank.name', header: 'bank_name' },
      { field: 'accountNumber', header: 'account_number' },
      { field: 'accountType', header: 'account_type' },
      { field: 'currency', header: 'currency' },
      { field: 'currentBalance', header: 'current_balance' },
      { field: 'active', header: 'status' }
    ];
  }

  setupAccountTypes() {
    this.accountTypes = [
      { label: this.translate.instant('account_type_checking'), value: 'CHECKING' },
      { label: this.translate.instant('account_type_savings'), value: 'SAVINGS' },
      { label: this.translate.instant('account_type_current'), value: 'CURRENT' },
      { label: this.translate.instant('account_type_credit_line'), value: 'CREDIT_LINE' },
      { label: this.translate.instant('account_type_term_deposit'), value: 'TERM_DEPOSIT' },
      { label: this.translate.instant('account_type_investment'), value: 'INVESTMENT' }
    ];
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canAddAccount = this.permissionService.canCreate(this.Ressource);
    this.canEditAccount = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteAccount = this.permissionService.canDelete(this.Ressource);
    this.canReadAccount = this.permissionService.canRead(this.Ressource);
  }

  async loadBanks() {
    try {
      const response = await firstValueFrom(await this.bankAccountService.getBanks(true));
      this.banks = response || [];
    } catch (error) {
      console.error('Error loading banks:', error);
    }
  }

  async loadAccounts() {
    this.isLoading = true;
    try {
      const response = await firstValueFrom(await this.bankAccountService.getBankAccounts());
      this.accounts = (response || []).filter(acc => {
        if (this.activeFilter !== undefined && acc.active !== this.activeFilter) return false;
        if (this.bankFilter && acc.bank.bankId !== this.bankFilter) return false;
        if (this.accountTypeFilter && acc.accountType !== this.accountTypeFilter) return false;
        return true;
      });
    } catch (error) {
      console.error('Error loading accounts:', error);
      this.accounts = [];
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_accounts'),
        life: 3000
      });
    } finally {
      this.isLoading = false;
      this.isInitialLoad = false;
    }
  }

  openNew() {
    if (!this.canAddAccount) return;
    this.account = {
      bank: {} as Bank,
      accountName: '',
      accountType: 'CHECKING',
      openingBalance: 0,
      currency: this.currency,
      active: true
    };
    this.submitted = false;
    this.accountDialog = true;
  }

  editAccount(account: BankAccount) {
    if (!this.canEditAccount) return;
    this.account = { ...account };
    this.accountDialog = true;
    this.submitted = false;
  }

  deleteAccount(account: BankAccount) {
    if (!this.canDeleteAccount) return;
    this.account = { ...account };
    this.deleteAccountDialog = true;
  }

  deleteSelectedAccounts() {
    if (!this.canDeleteAccount) return;
    this.deleteAccountsDialog = true;
  }

  async confirmDelete() {
    this.deleteAccountDialog = false;
    try {
      await firstValueFrom(await this.bankAccountService.deleteBankAccount(this.account.accountId!));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('account_deleted'),
        life: 3000
      });
      await this.loadAccounts();
      this.account = {} as BankAccount;
    } catch (error: any) {
      console.error('Error deleting account:', error);
      const errorMsg = error?.error?.message || this.translate.instant('error_deleting_account');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMsg,
        life: 3000
      });
    }
  }

  async confirmDeleteSelected() {
    this.deleteAccountsDialog = false;
    const deletePromises = this.selectedAccounts.map(async account => {
      const observable$ = await this.bankAccountService.deleteBankAccount(account.accountId!);
      return firstValueFrom(observable$);
    });
    
    try {
      await Promise.all(deletePromises);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('accounts_deleted'),
        life: 3000
      });
      this.selectedAccounts = [];
      await this.loadAccounts();
    } catch (error) {
      console.error('Error deleting accounts:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_deleting_accounts'),
        life: 3000
      });
    }
  }

  hideDialog() {
    this.accountDialog = false;
    this.submitted = false;
    this.account = {} as BankAccount;
  }

  async saveAccount() {
    this.submitted = true;

    // Validation
    if (!this.account.bank?.bankId) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('bank_required'),
        life: 3000
      });
      return;
    }

    if (!this.account.accountName || this.account.accountName.trim() === '') {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('account_name_required'),
        life: 3000
      });
      return;
    }

    if (!this.account.accountType) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('account_type_required'),
        life: 3000
      });
      return;
    }

    if (this.account.openingBalance === undefined || this.account.openingBalance === null) {
      this.account.openingBalance = 0;
    }

    try {
      if (this.account.accountId) {
        // Update
        await firstValueFrom(await this.bankAccountService.updateBankAccount(this.account.accountId, this.account));
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('account_updated'),
          life: 3000
        });
      } else {
        // Create
        if (!this.account.openingDate) {
          this.account.openingDate = new Date().toISOString().split('T')[0];
        }
        try {
          await firstValueFrom(await this.bankAccountService.createBankAccount(this.account));
        } catch (error: any) {
          // Handle case where backend returns 201 but response has parsing issues
          if (error?.status === 201) {
            // Success - account was created even if response parsing failed
            console.log('Account created successfully (status 201)');
          } else {
            throw error; // Re-throw if it's not a 201 status
          }
        }
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('account_created'),
          life: 3000
        });
      }
      this.accountDialog = false;
      this.account = {} as BankAccount;
      await this.loadAccounts();
    } catch (error: any) {
      console.error('Error saving account:', error);
      // If status is 201, treat as success (backend created the resource)
      if (error?.status === 201) {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('account_created'),
          life: 3000
        });
        this.accountDialog = false;
        this.account = {} as BankAccount;
        await this.loadAccounts();
      } else {
        const errorMsg = error?.error?.message || this.translate.instant('error_saving_account');
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: errorMsg,
          life: 3000
        });
      }
    }
  }

  viewAccountDetails(account: BankAccount) {
    if (!this.canReadAccount) return;
    this.router.navigate(['/finance/banking/accounts', account.accountId]);
  }

  recordTransaction(account: BankAccount) {
    if (!this.canAddAccount) return;
    this.transactionAccount = account;
    this.transactionDialogConfig = {
      visible: true,
      transaction: this.createEmptyTransaction(account),
      submitted: false
    };
  }

  createEmptyTransaction(account: BankAccount): BankTransaction {
    return {
      account,
      type: 'DEPOSIT',
      amount: 0,
      transactionDate: new Date().toISOString().split('T')[0]
    };
  }

  onTransactionDialogConfigChange(config: TransactionFormDialogConfig) {
    this.transactionDialogConfig = config;
  }

  onTransactionCancel() {
    this.transactionDialogConfig.visible = false;
    this.transactionDialogConfig.submitted = false;
    this.transactionAccount = null;
  }

  async onTransactionSave(data: TransactionFormDialogData) {
    this.transactionDialogConfig.submitted = true;
    const transaction = data.transaction;

    if (!transaction.type) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('transaction_type_required'),
        life: 3000
      });
      return;
    }

    if (!transaction.amount || transaction.amount <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('transaction_amount_required'),
        life: 3000
      });
      return;
    }

    if (!this.transactionAccount?.accountId) {
      return;
    }

    if (!transaction.transactionDate) {
      transaction.transactionDate = new Date().toISOString().split('T')[0];
    }

    try {
      await firstValueFrom(
        await this.bankAccountService.recordTransaction(this.transactionAccount.accountId, transaction)
      );
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('transaction_recorded'),
        life: 3000
      });
      this.transactionDialogConfig.visible = false;
      this.transactionDialogConfig.submitted = false;
      this.transactionAccount = null;
      await this.loadAccounts();
    } catch (error: any) {
      console.error('Error recording transaction:', error);
      const errorMsg = error?.error?.message || this.translate.instant('error_recording_transaction');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMsg,
        life: 3000
      });
    }
  }

  getMaskedAccountNumber(accountNumber?: string): string {
    if (!accountNumber) return '-';
    if (accountNumber.length <= 4) return accountNumber;
    return '****' + accountNumber.slice(-4);
  }

  getBalanceColor(balance: number): string {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  }

  formatBalance(balance: number, currency?: string): string {
    const curr = currency || this.currency;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(balance);
  }

  async onFilterChange() {
    if (this.isInitialLoad) {
      return;
    }
    await this.loadAccounts();
  }

  clear(table: Table) {
    table.clear();
    this.globalFilter = '';
    this.activeFilter = undefined;
    this.bankFilter = undefined;
    this.accountTypeFilter = undefined;
    void this.loadAccounts();
  }
}

