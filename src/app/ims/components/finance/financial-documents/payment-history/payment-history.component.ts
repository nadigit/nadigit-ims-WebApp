import { Component, Input } from '@angular/core';
import { PaymentAllocation } from 'src/app/models/financialDocument';

@Component({
  selector: 'app-payment-history',
  templateUrl: './payment-history.component.html',
  styleUrls: ['./payment-history.component.css']
})
export class PaymentHistoryComponent {
  @Input() allocations: PaymentAllocation[] = [];
  @Input() totalAmount: number = 0;
  @Input() currency: string = 'USD';

  getTotalPaid(): number {
    return this.allocations?.reduce((sum, allocation) => sum + (allocation.allocatedAmount || 0), 0) || 0;
  }

  getRemainingBalance(): number {
    return this.totalAmount - this.getTotalPaid();
  }

  isFullyPaid(): boolean {
    return this.getRemainingBalance() <= 0;
  }

  getPaymentStatusSeverity(status: string): string {
    switch (status?.toUpperCase()) {
      case 'SETTLED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'FAILED':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  getPaymentStatusIcon(status: string): string {
    switch (status?.toUpperCase()) {
      case 'SETTLED':
        return 'pi pi-check-circle';
      case 'PENDING':
        return 'pi pi-clock';
      case 'FAILED':
        return 'pi pi-times-circle';
      default:
        return 'pi pi-circle';
    }
  }

  getPaymentMethodLabel(method: string): string {
    if (!method) return 'N/A';
    return method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}
