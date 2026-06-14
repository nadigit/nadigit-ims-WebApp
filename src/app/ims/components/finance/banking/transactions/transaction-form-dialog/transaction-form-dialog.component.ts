import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { BankAccount } from 'src/app/models/bank-account';
import { BankTransaction, TransactionType } from 'src/app/models/bank-transaction';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';

export interface TransactionFormDialogConfig {
  visible: boolean;
  transaction: BankTransaction;
  submitted: boolean;
}

export interface TransactionFormDialogData {
  transaction: BankTransaction;
}

@Component({
  selector: 'app-transaction-form-dialog',
  templateUrl: './transaction-form-dialog.component.html',
  styleUrls: ['./transaction-form-dialog.component.css']
})
export class TransactionFormDialogComponent implements OnInit, OnChanges {

  @Input() config!: TransactionFormDialogConfig;
  @Input() account: BankAccount | null = null;
  @Input() currency: string = 'USD';

  @Output() configChange = new EventEmitter<TransactionFormDialogConfig>();
  @Output() save = new EventEmitter<TransactionFormDialogData>();
  @Output() cancel = new EventEmitter<void>();

  transactionTypes: { label: string; value: TransactionType }[] = [];
  maxDate: Date = new Date();

  constructor(
    private translate: TranslateService,
    private translateService: TranslationService
  ) { }

  ngOnInit(): void {
    this.translateService.currentLanguage$.subscribe(() => this.setupTransactionTypes());
    this.setupTransactionTypes();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['account']?.currentValue?.currency) {
      this.currency = changes['account'].currentValue.currency;
    }
  }

  setupTransactionTypes(): void {
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

  getBalanceAfter(): number {
    if (!this.account) {
      return 0;
    }
    const currentBalance = this.account.currentBalance || 0;
    const amount = this.config.transaction.amount || 0;
    if (this.isCreditTransaction()) {
      return currentBalance + amount;
    }
    return currentBalance - amount;
  }

  isCreditTransaction(): boolean {
    const depositTypes: TransactionType[] = ['DEPOSIT', 'TRANSFER_IN', 'RECEIPT', 'INTEREST'];
    return depositTypes.includes(this.config.transaction.type);
  }

  getBalanceColor(balance: number): string {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  }

  formatBalance(balance: number): string {
    const curr = this.account?.currency || this.currency;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(balance);
  }

  onSave(): void {
    this.save.emit({ transaction: this.config.transaction });
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
