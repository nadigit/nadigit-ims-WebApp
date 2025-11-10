import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LazyLoadEvent } from 'primeng/api';
import { Payment } from 'src/app/models/payment';
import { getPaymentMethodLabel } from 'src/app/shared/payment-utils';

@Component({
  selector: 'app-payments-table',
  templateUrl: './payments-table.component.html',
  styleUrls: ['./payments-table.component.css']
})
export class PaymentsTableComponent {
  @Input() payments: Payment[] = [];
  @Input() cols: any[] = [];
  @Input() pageSize = 20;
  @Input() totalRecords = 0;
  @Input() isLoading = false;
  @Input() canEditPayment = false;
  @Input() canDeletePayment = false;
  @Input() canAddPayment = false;
  @Input() canReadPayment = false;
  @Input() canConfirmPayment = false;
  @Input() context: 'incoming' | 'outgoing' = 'incoming';
  @Input() currency: string = 'USD';
  @Input() selectedPayments: Payment[] = [];

  @Output() editPaymentEvent = new EventEmitter<Payment>();
  @Output() deletePaymentEvent = new EventEmitter<Payment>();
  @Output() addPaymentEvent = new EventEmitter<Payment>();
  @Output() confirmPaymentEvent = new EventEmitter<Payment>();
  @Output() viewPaymentDetailsEvent = new EventEmitter<Payment>();
  @Output() printReceiptEvent = new EventEmitter<string>();
  @Output() generateReceiptEvent = new EventEmitter<string>();
  @Output() lazyLoadEvent = new EventEmitter<LazyLoadEvent>();
  @Output() onGlobalFilter = new EventEmitter<{ globalFilter: string, context: 'incoming' | 'outgoing' }>();
  @Output() deleteSelectedEvent = new EventEmitter<LazyLoadEvent>();
  @Output() selectedPaymentsChange = new EventEmitter<Payment[]>();
  // @Output() paymentNotSettledEvent = new EventEmitter<Payment>();
  @Output() paymentMethodIconEvent = new EventEmitter<LazyLoadEvent>();
  @Output() paymentMethodSeverityEvent = new EventEmitter<LazyLoadEvent>();

  onSelectionChange(event: Payment[]) {
    this.selectedPaymentsChange.emit(event); // this triggers parent two-way binding
  }

  onLazyLoad(event: LazyLoadEvent) {
    // emit context using 'as any' to avoid type errors
    this.lazyLoadEvent.emit({ ...event, context: this.context } as any);
  }

  isPaymentNotSettled(payment: Payment): boolean {
    const today = new Date();
    const paymentDate = new Date(payment.paymentDate);

    const isToday =
      paymentDate.getFullYear() === today.getFullYear() &&
      paymentDate.getMonth() === today.getMonth() &&
      paymentDate.getDate() === today.getDate();

    return isToday && payment.paymentStatus !== 'SETTLED';
  }

  applyGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value.trim();
    this.onGlobalFilter.emit({ globalFilter: value, context: this.context });
  }


  getPaymentMethodLabel(paymentMethod: string) {
    return getPaymentMethodLabel(paymentMethod);
  }

}
