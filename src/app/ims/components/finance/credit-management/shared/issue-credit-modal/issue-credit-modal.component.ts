import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { CustomerCreditService } from 'src/app/services/customer-credit.service';
import { CustomerCreditAccount } from 'src/app/models/customer-credit-account';
import { CustomerCreditTransaction } from 'src/app/models/customer-credit-transaction';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-issue-credit-modal',
  templateUrl: './issue-credit-modal.component.html',
  styleUrls: ['./issue-credit-modal.component.css']
})
export class IssueCreditModalComponent implements OnInit {
  @Input() visible: boolean = false;
  @Input() customerId?: number;
  @Input() creditAccount?: CustomerCreditAccount;
  @Input() currency: string = 'USD';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() creditIssued = new EventEmitter<CustomerCreditTransaction>();

  amount: number | null = null;
  description: string = '';
  expirationDate: Date | null = null;
  submitted: boolean = false;
  isSaving: boolean = false;
  minDate: Date = new Date();

  constructor(
    private creditService: CustomerCreditService,
    private messageService: MessageService,
    private translate: TranslateService
  ) {}

  ngOnInit() {}

  async saveCredit() {
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

    if (!this.amount || this.amount <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('amount_must_be_positive'),
        life: 3000
      });
      return;
    }

    // Check credit limit if set
    if (this.creditAccount?.creditLimit && this.creditAccount.creditLimit > 0) {
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
      const expirationDateStr = this.expirationDate ? this.formatDate(this.expirationDate) : undefined;
      const transaction$ = await this.creditService.issueCredit(
        this.customerId,
        this.amount,
        this.description || undefined,
        expirationDateStr
      );
      const transaction = await firstValueFrom(transaction$);

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('credit_issued_successfully'),
        life: 3000
      });

      this.creditIssued.emit(transaction);
      this.close();
    } catch (error: any) {
      console.error('Error issuing credit:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_issuing_credit'),
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
    this.description = '';
    this.expirationDate = null;
    this.submitted = false;
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getMaxDate(): Date {
    // Allow expiration date up to 1 year from now
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    return maxDate;
  }
}

