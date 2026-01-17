import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { CustomerCreditService } from 'src/app/services/customer-credit.service';
import { CustomerCreditAccount } from 'src/app/models/customer-credit-account';
import { CustomerCreditTransaction } from 'src/app/models/customer-credit-transaction';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-adjust-credit-modal',
  templateUrl: './adjust-credit-modal.component.html',
  styleUrls: ['./adjust-credit-modal.component.css']
})
export class AdjustCreditModalComponent implements OnInit {
  @Input() visible: boolean = false;
  @Input() customerId?: number;
  @Input() creditAccount?: CustomerCreditAccount;
  @Input() currency: string = 'USD';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() creditAdjusted = new EventEmitter<CustomerCreditTransaction>();

  amount: number | null = null;
  reason: string = '';
  notes: string = '';
  submitted: boolean = false;
  isSaving: boolean = false;

  constructor(
    private creditService: CustomerCreditService,
    private messageService: MessageService,
    private translate: TranslateService
  ) {}

  ngOnInit() {}

  async saveAdjustment() {
    this.submitted = true;

    if (!this.customerId) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('customer_required'),
        life: 3000
      });
      return;
    }

    if (!this.amount || this.amount === 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('amount_cannot_be_zero'),
        life: 3000
      });
      return;
    }

    if (!this.reason || this.reason.trim() === '') {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('reason_required'),
        life: 3000
      });
      return;
    }

    // Check credit limit if increasing
    if (this.amount > 0 && this.creditAccount?.creditLimit && this.creditAccount.creditLimit > 0) {
      const currentBalance = this.creditAccount.creditBalance || 0;
      const newBalance = currentBalance + this.amount;
      if (newBalance > this.creditAccount.creditLimit) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('credit_limit_exceeded', {
            current: currentBalance,
            limit: this.creditAccount.creditLimit,
            requested: this.amount
          }),
          life: 5000
        });
        return;
      }
    }

    // Check available balance if decreasing
    if (this.amount < 0) {
      const currentBalance = this.creditAccount?.creditBalance || 0;
      const decreaseAmount = Math.abs(this.amount);
      if (decreaseAmount > currentBalance) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('insufficient_credit_balance', {
            available: currentBalance,
            requested: decreaseAmount
          }),
          life: 3000
        });
        return;
      }
    }

    // Check account status
    if (this.creditAccount?.status !== 'ACTIVE') {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('credit_account_not_active'),
        life: 3000
      });
      return;
    }

    this.isSaving = true;

    try {
      const transaction$ = await this.creditService.adjustCredit(
        this.customerId,
        this.amount,
        this.reason,
        this.notes || undefined
      );
      const transaction = await firstValueFrom(transaction$);

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('credit_adjusted_successfully'),
        life: 3000
      });

      this.creditAdjusted.emit(transaction);
      this.close();
    } catch (error: any) {
      console.error('Error adjusting credit:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_adjusting_credit'),
        life: 3000
      });
    } finally {
      this.isSaving = false;
    }
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.reset();
  }

  reset() {
    this.amount = null;
    this.reason = '';
    this.notes = '';
    this.submitted = false;
  }

  getAdjustmentType(): string {
    if (!this.amount) return '';
    return this.amount > 0 ? 'increase' : 'decrease';
  }
}

