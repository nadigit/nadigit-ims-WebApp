import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { LazyLoadEvent } from 'primeng/api';
import { BankAccount } from 'src/app/models/bank-account';
import { BankTransaction, TransactionFilter, AccountSummary, PageResponse } from 'src/app/models/bank-transaction';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';
import {
  TransactionFormDialogConfig,
  TransactionFormDialogData
} from '../transactions/transaction-form-dialog/transaction-form-dialog.component';

@Component({
  templateUrl: './account-details.component.html',
  styleUrls: ['./account-details.component.css', '../../finance.component.css'],
  providers: [MessageService]
})
export class AccountDetailsComponent implements OnInit {
  TablePageSizeKeys = TablePageSizeKeys;

  accountId!: number;
  account: BankAccount | null = null;
  transactions: BankTransaction[] = [];
  summary: AccountSummary | null = null;

  isLoading: boolean = true;
  transactionsLoading: boolean = false;

  totalRecords: number = 0;
  pageSize: number = 20;
  currentPage: number = 0;

  currency: string = 'USD';
  dateRange: Date[] = [];
  transactionTypeFilter: string | undefined = undefined;
  reconciledFilter: boolean | undefined = undefined;

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
  reconcileDialog: boolean = false;
  transactionDetailsDialog: boolean = false;
  selectedTransaction: BankTransaction | null = null;
  selectedTransactions: BankTransaction[] = [];

  canReconcile: boolean = false;
  canRecordTransaction: boolean = false;

  Ressource: string = 'BANK_ACCOUNTS';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private bankAccountService: BankAccountService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private cdr: ChangeDetectorRef,
    public pageSizeService: TablePageSizeService
  ) { }

  async ngOnInit() {
    this.pageSize = this.pageSizeService.initState(
      TablePageSizeKeys.accountDetailsTransactions,
      [20, 50, 100],
      { pageSize: this.pageSize },
      this.pageSize
    );
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.accountId = +params['id'];
      await this.checkPermissions();
      await this.loadAccount();
      await this.loadSummary();
      await this.loadTransactions();
      this.isLoading = false;
    });
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canReconcile = this.permissionService.canUpdate(this.Ressource);
    this.canRecordTransaction = this.permissionService.canCreate(this.Ressource);
  }

  get unreconciledCount(): number {
    return this.transactions.filter(t => !t.reconciled).length;
  }

  async loadAccount() {
    try {
      const response = await firstValueFrom(await this.bankAccountService.getBankAccount(this.accountId));
      this.account = response;
      if (this.account?.currency) {
        this.currency = this.account.currency;
      }
    } catch (error) {
      console.error('Error loading account:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_account'),
        life: 3000
      });
      this.router.navigate(['/finance/banking/accounts']);
    }
  }

  async loadSummary() {
    if (!this.accountId) return;
    try {
      const startDate = this.dateRange[0]?.toISOString().split('T')[0];
      const endDate = this.dateRange[1]?.toISOString().split('T')[0];
      const response = await firstValueFrom(
        await this.bankAccountService.getAccountSummary(this.accountId, startDate, endDate)
      );
      this.summary = response;
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  }

  async loadTransactions(event?: LazyLoadEvent) {
    if (!this.accountId) return;
    
    // Defer the loading state change to avoid ExpressionChangedAfterItHasBeenCheckedError
    await Promise.resolve();
    this.transactionsLoading = true;

    try {
      if (event) {
        this.pageSizeService.applyPageEvent(
          TablePageSizeKeys.accountDetailsTransactions,
          [20, 50, 100],
          event,
          this
        );
      }
      const filter: TransactionFilter = {
        page: event?.first ? Math.floor(event.first / (event.rows || this.pageSize)) : this.currentPage,
        size: event?.rows || this.pageSize,
        sortBy: event?.sortField || 'transactionDate',
        sortDirection: event?.sortOrder === 1 ? 'desc' : 'asc',
        type: this.transactionTypeFilter as any,
        reconciled: this.reconciledFilter
      };

      if (this.dateRange[0]) {
        filter.startDate = this.dateRange[0].toISOString().split('T')[0];
      }
      if (this.dateRange[1]) {
        filter.endDate = this.dateRange[1].toISOString().split('T')[0];
      }

      const response = await firstValueFrom(
        await this.bankAccountService.getTransactions(this.accountId, filter)
      );
      
      this.transactions = response.content || [];
      this.totalRecords = response.totalElements || 0;
      this.currentPage = response.number || 0;
    } catch (error) {
      console.error('Error loading transactions:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_transactions'),
        life: 3000
      });
    } finally {
      this.transactionsLoading = false;
    }
  }

  async onDateRangeChange() {
    await this.loadSummary();
    await this.loadTransactions();
  }

  async onFilterChange() {
    await this.loadTransactions();
  }

  recordTransaction() {
    if (!this.canRecordTransaction || !this.account) return;
    this.transactionDialogConfig = {
      visible: true,
      transaction: this.createEmptyTransaction(this.account),
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

    if (!transaction.transactionDate) {
      transaction.transactionDate = new Date().toISOString().split('T')[0];
    }

    try {
      await firstValueFrom(
        await this.bankAccountService.recordTransaction(this.accountId, transaction)
      );
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('transaction_recorded'),
        life: 3000
      });
      this.transactionDialogConfig.visible = false;
      this.transactionDialogConfig.submitted = false;
      await this.loadAccount();
      await this.loadSummary();
      await this.loadTransactions();
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

  viewTransactionDetails(transaction: BankTransaction) {
    this.selectedTransaction = transaction;
    this.transactionDetailsDialog = true;
  }

  async reconcileTransaction(transaction: BankTransaction) {
    try {
      await firstValueFrom(await this.bankAccountService.reconcileTransaction(transaction.transactionId!));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('transaction_reconciled'),
        life: 3000
      });
      await this.loadTransactions();
      await this.loadSummary();
    } catch (error) {
      console.error('Error reconciling transaction:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_reconciling_transaction'),
        life: 3000
      });
    }
  }

  async reconcileSelected() {
    if (this.selectedTransactions.length === 0) return;
    try {
      const transactionIds = this.selectedTransactions.map(t => t.transactionId!);
      await firstValueFrom(await this.bankAccountService.reconcileBatch(transactionIds));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('transactions_reconciled'),
        life: 3000
      });
      this.selectedTransactions = [];
      await this.loadTransactions();
      await this.loadSummary();
    } catch (error) {
      console.error('Error reconciling transactions:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_reconciling_transactions'),
        life: 3000
      });
    }
  }

  async reverseTransaction(transaction: BankTransaction) {
    try {
      await firstValueFrom(await this.bankAccountService.reverseTransaction(transaction.transactionId!));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('transaction_reversed'),
        life: 3000
      });
      await this.loadAccount();
      await this.loadTransactions();
      await this.loadSummary();
    } catch (error) {
      console.error('Error reversing transaction:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_reversing_transaction'),
        life: 3000
      });
    }
  }

  async recalculateBalance() {
    try {
      await firstValueFrom(await this.bankAccountService.recalculateBalance(this.accountId));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('balance_recalculated'),
        life: 3000
      });
      await this.loadAccount();
      await this.loadSummary();
    } catch (error) {
      console.error('Error recalculating balance:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_recalculating_balance'),
        life: 3000
      });
    }
  }

  openReconcile() {
    this.router.navigate(['/finance/banking/accounts', this.accountId, 'reconcile']);
  }

  getBalanceColor(balance: number): string {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  }

  formatBalance(balance: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(balance);
  }

  getTransactionTypeLabel(type: string): string {
    return this.translate.instant('transaction_type_' + type.toLowerCase());
  }

  getTransactionTypeSeverity(type: string): string {
    const depositTypes = ['DEPOSIT', 'TRANSFER_IN', 'RECEIPT', 'INTEREST'];
    if (depositTypes.includes(type)) return 'success';
    return 'danger';
  }

  getTransactionTypeSeverityTag(type: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    const depositTypes = ['DEPOSIT', 'TRANSFER_IN', 'RECEIPT', 'INTEREST'];
    if (depositTypes.includes(type)) return 'success';
    return 'danger';
  }

  getTransactionTypeIcon(type: string): string {
    const depositTypes = ['DEPOSIT', 'TRANSFER_IN', 'RECEIPT', 'INTEREST'];
    if (depositTypes.includes(type)) return 'pi pi-arrow-down';
    return 'pi pi-arrow-up';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
  }
}

