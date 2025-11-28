import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LazyLoadEvent } from 'primeng/api';
import { Customer } from 'src/app/models/customer';
import { Order } from 'src/app/models/order';
import { Payment } from 'src/app/models/payment';
import { Product } from 'src/app/models/product';
import { Shop } from 'src/app/models/shop';
import { getPaymentMethodLabel } from 'src/app/shared/payment-utils';

interface LazyLoadEventExt extends LazyLoadEvent {
  globalFilter?: string;
  filters?: { [field: string]: any };
}

@Component({
  selector: 'app-orders-table',
  templateUrl: './orders-table.component.html',
  styleUrls: ['./orders-table.component.css', '../orders.component.css', '../../sales.component.css']
})
export class OrdersTableComponent {
  @Input() orders: Order[] = [];
  @Input() cols: any[] = [];
  @Input() pageSize = 20;
  @Input() totalRecords = 0;
  @Input() totalAmount = 0;
  @Input() totalPaid = 0
  @Input() remainingBalance = 0;
  @Input() isLoading = false;
  @Input() isAdmin = false;
  @Input() canEditOrder = false;
  @Input() canDeleteOrder = false;
  @Input() canAddOrder = false;
  @Input() canReadOrder = false;
  @Input() canProcessOrder = false;
  @Input() canCancelOrder = false;
  @Input() currency: string = 'USD';
  @Input() expandedRows: { [key: number]: boolean } = {};
  @Input() selectedOrders: Order[] = [];
  @Input() getCustomerDisplayName!: (c: Customer) => string;
  @Input() isReturnedStatus!: (status: string) => boolean;
  @Input() getReturnTooltip!: (status: string) => string;
  @Input() isRowExpanded!: (orderId: number) => boolean;
  @Input() toggleRow!: (orderId: number) => void;
  @Input() hasReturns!: (order: Order) => boolean;
  @Input() hasRefunds!: (order: Order) => boolean;
  @Input() getTotalRefundedAmount!: (order: Order) => number;
  @Input() getNetAmount!: (order: Order) => number;
  @Input() customers: Customer[] = [];
  @Input() shops: Shop[] = [];
  @Input() statuses: string[] = [];
  @Input() paymentStatuses: string[] = [];

  @Output() editOrderEvent = new EventEmitter<Order>();
  @Output() deleteOrderEvent = new EventEmitter<Order>();
  @Output() addOrderEvent = new EventEmitter<void>();
  @Output() confirmOrderEvent = new EventEmitter<Order>();
  @Output() processOrderEvent = new EventEmitter<Order>();
  @Output() cancelOrderEvent = new EventEmitter<Order>();
  @Output() lazyLoadEvent = new EventEmitter<LazyLoadEventExt>();
  @Output() onGlobalFilter = new EventEmitter<{ globalFilter: string }>();
  @Output() deleteSelectedOrdersEvent = new EventEmitter<LazyLoadEvent>();
  @Output() selectedOrdersChange = new EventEmitter<Payment[]>();
  @Output() viewProductDetailsEvent = new EventEmitter<Product>();
  @Output() exportPdfEvent = new EventEmitter<void>();
  @Output() exportExcelEvent = new EventEmitter<void>();

  constructor() { }

  onSelectionChange(event: Payment[]) {
    this.selectedOrdersChange.emit(event);
  }

  onLazyLoad(event: LazyLoadEvent) {
    this.lazyLoadEvent.emit({ ...event } as any);
  }

  applyGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value.trim();
    this.onGlobalFilter.emit({ globalFilter: value });
  }


}
