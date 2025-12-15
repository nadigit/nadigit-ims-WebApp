import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BankAccount } from 'src/app/models/bank-account';
import { BankTransaction, TransactionFilter } from 'src/app/models/bank-transaction';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { firstValueFrom } from 'rxjs';

@Component({
  templateUrl: './reconciliation.component.html',
  styleUrls: ['./reconciliation.component.css', '../../finance.component.css'],
  providers: [MessageService]
})
export class ReconciliationComponent implements OnInit {

  accountId!: number;
  account: BankAccount | null = null;
  unreconciledTransactions: BankTransaction[] = [];
  selectedTransactions: BankTransaction[] = [];

  isLoading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private bankAccountService: BankAccountService,
    private translate: TranslateService,
    private translateService: TranslationService
  ) { }

  async ngOnInit() {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.accountId = +params['accountId'];
      await this.loadAccount();
      await this.loadUnreconciledTransactions();
      this.isLoading = false;
    });
  }

  async loadAccount() {
    try {
      const response = await firstValueFrom(await this.bankAccountService.getBankAccount(this.accountId));
      this.account = response;
    } catch (error) {
      console.error('Error loading account:', error);
      this.router.navigate(['/finance/banking/accounts']);
    }
  }

  async loadUnreconciledTransactions() {
    try {
      const filter: TransactionFilter = {
        reconciled: false,
        page: 0,
        size: 200,
        sortBy: 'transactionDate',
        sortDirection: 'desc'
      };
      const response = await firstValueFrom(
        await this.bankAccountService.getTransactions(this.accountId, filter)
      );
      this.unreconciledTransactions = response.content || [];
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }

  async reconcileSelected() {
    if (this.selectedTransactions.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('select_transactions_to_reconcile'),
        life: 3000
      });
      return;
    }

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
      await this.loadUnreconciledTransactions();
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

  async reconcileAll() {
    if (this.unreconciledTransactions.length === 0) {
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('info'),
        detail: this.translate.instant('no_unreconciled_transactions'),
        life: 3000
      });
      return;
    }

    try {
      const transactionIds = this.unreconciledTransactions.map(t => t.transactionId!);
      await firstValueFrom(await this.bankAccountService.reconcileBatch(transactionIds));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('all_transactions_reconciled'),
        life: 3000
      });
      await this.loadUnreconciledTransactions();
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

  formatBalance(balance: number, currency?: string): string {
    const curr = currency || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(balance);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
  }

  cancel() {
    this.router.navigate(['/finance/banking/accounts', this.accountId]);
  }
}

