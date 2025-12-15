import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BankAccount } from 'src/app/models/bank-account';
import { BankTransaction, TransactionType } from 'src/app/models/bank-transaction';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom } from 'rxjs';

@Component({
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.css', '../../finance.component.css'],
  providers: [MessageService]
})
export class TransactionComponent implements OnInit {

  accountId!: number;
  account: BankAccount | null = null;
  transaction: BankTransaction = {
    account: {} as BankAccount,
    type: 'DEPOSIT',
    amount: 0,
    transactionDate: new Date().toISOString().split('T')[0]
  };

  submitted: boolean = false;
  isLoading: boolean = true;
  currency: string = 'USD';
  maxDate: Date = new Date();

  transactionTypes: { label: string, value: TransactionType }[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private bankAccountService: BankAccountService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService
  ) { }

  async ngOnInit() {
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.accountId = +params['accountId'];
      await this.loadAccount();
      this.setupTransactionTypes();
      this.transaction.account = this.account!;
      this.isLoading = false;
    });
  }

  setupTransactionTypes() {
    this.transactionTypes = [
      { label: this.translate.instant('transaction_type_deposit'), value: 'DEPOSIT' },
      { label: this.translate.instant('transaction_type_withdrawal'), value: 'WITHDRAWAL' },
      { label: this.translate.instant('transaction_type_transfer_in'), value: 'TRANSFER_IN' },
      { label: this.translate.instant('transaction_type_transfer_out'), value: 'TRANSFER_OUT' },
      { label: this.translate.instant('transaction_type_payment'), value: 'PAYMENT' },
      { label: this.translate.instant('transaction_type_receipt'), value: 'RECEIPT' },
      { label: this.translate.instant('transaction_type_fee'), value: 'FEE' },
      { label: this.translate.instant('transaction_type_interest'), value: 'INTEREST' },
      { label: this.translate.instant('transaction_type_adjustment'), value: 'ADJUSTMENT' }
    ];
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

  getBalanceAfter(): number {
    if (!this.account) return 0;
    const currentBalance = this.account.currentBalance || 0;
    const amount = this.transaction.amount || 0;
    
    const depositTypes = ['DEPOSIT', 'TRANSFER_IN', 'RECEIPT', 'INTEREST'];
    if (depositTypes.includes(this.transaction.type)) {
      return currentBalance + amount;
    }
    return currentBalance - amount;
  }

  getTransactionTypeSeverity(): string {
    const depositTypes = ['DEPOSIT', 'TRANSFER_IN', 'RECEIPT', 'INTEREST'];
    if (depositTypes.includes(this.transaction.type)) return 'success';
    return 'danger';
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

  async saveTransaction() {
    this.submitted = true;

    if (!this.transaction.type) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('transaction_type_required'),
        life: 3000
      });
      return;
    }

    if (!this.transaction.amount || this.transaction.amount <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('transaction_amount_required'),
        life: 3000
      });
      return;
    }

    if (!this.transaction.transactionDate) {
      this.transaction.transactionDate = new Date().toISOString().split('T')[0];
    }

    try {
      await firstValueFrom(
        await this.bankAccountService.recordTransaction(this.accountId, this.transaction)
      );
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('transaction_recorded'),
        life: 3000
      });
      this.router.navigate(['/finance/banking/accounts', this.accountId]);
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

  cancel() {
    this.router.navigate(['/finance/banking/accounts', this.accountId]);
  }
}
