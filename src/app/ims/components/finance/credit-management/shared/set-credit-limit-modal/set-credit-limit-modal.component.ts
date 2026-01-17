import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { CustomerCreditService } from 'src/app/services/customer-credit.service';
import { CustomerCreditAccount } from 'src/app/models/customer-credit-account';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-set-credit-limit-modal',
  templateUrl: './set-credit-limit-modal.component.html',
  styleUrls: ['./set-credit-limit-modal.component.css']
})
export class SetCreditLimitModalComponent implements OnInit, OnChanges {
  @Input() visible: boolean = false;
  @Input() customerId?: number;
  @Input() creditAccount?: CustomerCreditAccount;
  @Input() currency: string = 'USD';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() limitSet = new EventEmitter<CustomerCreditAccount>();

  creditLimit: number | null = null;
  submitted: boolean = false;
  isSaving: boolean = false;
  showWarning: boolean = false;

  constructor(
    private creditService: CustomerCreditService,
    private messageService: MessageService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    if (this.creditAccount) {
      this.creditLimit = this.creditAccount.creditLimit || null;
      this.checkWarning();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['creditAccount'] && this.creditAccount) {
      this.creditLimit = this.creditAccount.creditLimit || null;
      this.checkWarning();
    }
  }

  checkWarning() {
    if (this.creditAccount && this.creditLimit !== null && this.creditLimit !== undefined) {
      const currentBalance = this.creditAccount.creditBalance || 0;
      this.showWarning = currentBalance > this.creditLimit;
    } else {
      this.showWarning = false;
    }
  }

  onLimitChange() {
    this.checkWarning();
  }

  async saveLimit() {
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

    if (this.creditLimit === null || this.creditLimit === undefined || this.creditLimit < 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('credit_limit_must_be_positive_or_zero'),
        life: 3000
      });
      return;
    }

    this.isSaving = true;

    try {
      const account$ = await this.creditService.setCreditLimit(
        this.customerId,
        this.creditLimit
      );
      const account = await firstValueFrom(account$);

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('credit_limit_set_successfully'),
        life: 3000
      });

      this.limitSet.emit(account);
      this.close();
    } catch (error: any) {
      console.error('Error setting credit limit:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_setting_credit_limit'),
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
    if (this.creditAccount) {
      this.creditLimit = this.creditAccount.creditLimit || null;
    } else {
      this.creditLimit = null;
    }
    this.submitted = false;
    this.showWarning = false;
  }
}

