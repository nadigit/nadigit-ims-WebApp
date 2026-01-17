import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CustomerCreditAccount, CreditStatus } from 'src/app/models/customer-credit-account';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-credit-balance-card',
  templateUrl: './credit-balance-card.component.html',
  styleUrls: ['./credit-balance-card.component.css']
})
export class CreditBalanceCardComponent implements OnInit, OnChanges {
  @Input() creditAccount?: CustomerCreditAccount;
  @Input() currency: string = 'USD';
  @Input() showActions: boolean = true;
  @Input() isAdmin: boolean = false;
  @Output() viewDetails = new EventEmitter<void>();
  @Output() issueCredit = new EventEmitter<void>();
  @Output() adjustCredit = new EventEmitter<void>();
  @Output() setLimit = new EventEmitter<void>();
  @Output() changeStatus = new EventEmitter<void>();

  availableCredit: number = 0;

  constructor(private translate: TranslateService) {}

  ngOnInit() {
    this.calculateAvailableCredit();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['creditAccount']) {
      this.calculateAvailableCredit();
    }
  }

  calculateAvailableCredit() {
    if (!this.creditAccount) {
      this.availableCredit = 0;
      return;
    }

    const balance = this.creditAccount.creditBalance || 0;
    const limit = this.creditAccount.creditLimit || 0;

    if (limit === 0 || limit === null || limit === undefined) {
      // No limit, available credit is the balance
      this.availableCredit = balance;
    } else {
      // Available credit is the minimum of balance and remaining limit
      this.availableCredit = Math.min(balance, limit - balance);
    }
  }

  getStatusSeverity(status?: CreditStatus): string {
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

  getStatusLabel(status?: CreditStatus): string {
    if (!status) return '';
    return this.translate.instant(`credit_status_${status.toLowerCase()}`);
  }
}

