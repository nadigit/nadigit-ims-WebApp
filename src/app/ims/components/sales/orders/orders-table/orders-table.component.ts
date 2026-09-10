import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LazyLoadEvent } from 'primeng/api';
import { Customer } from 'src/app/models/customer';
import { Order } from 'src/app/models/order';
import { Payment } from 'src/app/models/payment';
import { OrderItem } from 'src/app/models/orderItem';
import { Product } from 'src/app/models/product';
import { Shop } from 'src/app/models/shop';
import { getPaymentMethodLabel } from 'src/app/shared/payment-utils';
import {
  formatLineQuantity,
  getLineMeasureUnit,
  getOrderItemDisplayQuantity,
  getOrderItemDisplayRemainingQuantity,
  getOrderItemDisplayReturnedQuantity,
  getProductTypeBadgeIcon,
  getProductTypeBadgeKey,
  getProductTypeBadgeSeverity,
  shouldShowLineMeasureUnit,
} from 'src/app/shared/product-utils';

interface LazyLoadEventExt extends LazyLoadEvent {
  globalFilter?: string;
  filters?: { [field: string]: any };
}

@Component({
  selector: 'app-orders-table',
  templateUrl: './orders-table.component.html',
  styleUrls: ['./orders-table.component.css', '../orders.component.css', '../../sales.component.css']
})
export class OrdersTableComponent implements OnChanges {
  @Input() orders: Order[] = [];
  @Input() cols: any[] = [];
  @Input() pageSize = 20;
  @Input() rowsPerPageOptions: number[] = [10, 20, 50];
  @Input() totalRecords = 0;
  @Input() totalAmount = 0;
  @Input() totalPaid = 0
  @Input() remainingBalance = 0;
  @Input() totalCost = 0;
  @Input() totalProfit = 0;
  @Input() isLoading = false;
  @Input() isInitialLoad = false;
  @Input() isExporting = false;
  @Input() isAdmin = false;
  @Input() canEditOrder = false;
  @Input() canDeleteOrder = false;
  @Input() canAddOrder = false;
  @Input() canReadOrder = false;
  @Input() canProcessOrder = false;
  @Input() canCancelOrder = false;
  /** When true, action tooltips use document-chain wording (sales.process.mode = DOCUMENT_CHAIN). */
  @Input() salesDocumentChainMode = false;
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
  @Input() statuses: any[] = [];
  @Input() paymentStatuses: any[] = [];
  /** Synced from parent when URL or menu applies ?orderStatus= */
  @Input() orderStatusFilter: string | null = null;

  // Filter properties
  selectedOrderStatus: string | null = null;
  selectedPaymentStatus: string | null = null;
  selectedCustomer: Customer | null = null;
  selectedShop: Shop | null = null;
  orderDateFrom: Date | null = null;
  orderDateTo: Date | null = null;
  showAdvancedFilters = false;

  @Output() editOrderEvent = new EventEmitter<Order>();
  @Output() deleteOrderEvent = new EventEmitter<Order>();
  @Output() addOrderEvent = new EventEmitter<void>();
  @Output() confirmOrderEvent = new EventEmitter<Order>();
  @Output() viewOrderEvent = new EventEmitter<Order>();
  @Output() processOrderEvent = new EventEmitter<Order>();
  @Output() deliverOrderEvent = new EventEmitter<Order>();
  @Output() completeOrderEvent = new EventEmitter<Order>();
  @Output() cancelOrderEvent = new EventEmitter<Order>();
  @Output() lazyLoadEvent = new EventEmitter<LazyLoadEventExt>();
  @Output() onGlobalFilter = new EventEmitter<{ globalFilter: string }>();
  @Output() deleteSelectedOrdersEvent = new EventEmitter<LazyLoadEvent>();
  @Output() selectedOrdersChange = new EventEmitter<Payment[]>();
  @Output() viewProductDetailsEvent = new EventEmitter<Product>();
  @Output() exportPdfEvent = new EventEmitter<void>();
  @Output() exportExcelEvent = new EventEmitter<void>();
  @Output() applyFiltersEvent = new EventEmitter<void>();
  @Output() resetFiltersEvent = new EventEmitter<void>();
  @Output() filterChangeEvent = new EventEmitter<{
    orderStatus?: string | null;
    paymentStatus?: string | null;
    customer?: Customer | null;
    shop?: Shop | null;
    orderDateFrom?: Date | null;
    orderDateTo?: Date | null;
  }>();

  constructor(private translate: TranslateService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderStatusFilter']) {
      this.selectedOrderStatus = this.orderStatusFilter ?? null;
    }
  }

  tooltipProcessOrder(): string {
    return this.salesDocumentChainMode
      ? this.translate.instant('doc_chain_tooltip_confirm_processing')
      : this.translate.instant('process_order_button');
  }

  tooltipDeliverOrder(): string {
    return this.salesDocumentChainMode
      ? this.translate.instant('doc_chain_tooltip_record_delivery')
      : this.translate.instant('deliver_order_button');
  }

  tooltipCompleteOrder(): string {
    return this.salesDocumentChainMode
      ? this.translate.instant('doc_chain_tooltip_close_document')
      : this.translate.instant('complete_order_button');
  }

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

  onOrderStatusChange(event: any) {
    console.log('Order status change event:', event);
    if (event && event.value !== undefined) {
      this.selectedOrderStatus = event.value;
      console.log('Set selectedOrderStatus to:', this.selectedOrderStatus);
    } else {
      this.selectedOrderStatus = null;
    }
  }

  onPaymentStatusChange(event: any) {
    console.log('Payment status change event:', event);
    if (event && event.value !== undefined) {
      this.selectedPaymentStatus = event.value;
      console.log('Set selectedPaymentStatus to:', this.selectedPaymentStatus);
    } else {
      this.selectedPaymentStatus = null;
    }
  }

  onFilterChange() {
    console.log('OrdersTable onFilterChange - selectedOrderStatus:', this.selectedOrderStatus, typeof this.selectedOrderStatus);
    console.log('OrdersTable onFilterChange - selectedPaymentStatus:', this.selectedPaymentStatus, typeof this.selectedPaymentStatus);

    this.filterChangeEvent.emit({
      orderStatus: this.selectedOrderStatus,
      paymentStatus: this.selectedPaymentStatus,
      customer: this.selectedCustomer,
      shop: this.selectedShop,
      orderDateFrom: this.orderDateFrom,
      orderDateTo: this.orderDateTo
    });
  }

  resetFilters() {
    this.selectedOrderStatus = null;
    this.selectedPaymentStatus = null;
    this.selectedCustomer = null;
    this.selectedShop = null;
    this.orderDateFrom = null;
    this.orderDateTo = null;
    this.resetFiltersEvent.emit();
  }

  // Cost and Profit helper methods
  /**
   * Columns actually rendered by the main table, so the empty message and the expanded row span
   * exactly the table and nothing is left hanging off the end.
   *
   * Always present: select, expander, reference, date, status, payment status, total/paid,
   * customer, actions. Profit needs cost data AND admin; shop needs admin. The hardcoded numbers
   * these replaced were wrong in every combination — the empty row stopped two columns short, so
   * Shop and Actions sat outside it.
   */
  get renderedColumnCount(): number {
    let count = 9;
    if (this.hasCostInfo() && this.isAdmin) {
      count++;
    }
    if (this.isAdmin) {
      count++;
    }
    return count;
  }

  hasCostInfo(): boolean {
    return this.orders.some(order => order.totalCost != null && order.totalCost !== undefined);
  }

  getProfitMarginSeverity(margin: number | null | undefined): string {
    if (margin == null) return 'secondary';
    if (margin >= 30) return 'success'; // High margin - Green
    if (margin >= 15) return 'warning'; // Medium margin - Yellow/Orange
    return 'danger'; // Low margin - Red
  }

  getProfitMarginClass(margin: number | null | undefined): string {
    if (margin == null) return '';
    if (margin >= 30) return 'high-margin';
    if (margin >= 15) return 'medium-margin';
    return 'low-margin';
  }

  getAmountTooltip(order: Order): string {
    if (!this.hasReturns || !this.hasReturns(order)) {
      return `${this.getCustomerDisplayName ? this.getCustomerDisplayName(order.customer!) : 'Order'}: ${order.totalAmount?.toFixed(2) || '0.00'}`;
    }
    const original = order.totalAmount || 0;
    const refunded = this.getTotalRefundedAmount ? this.getTotalRefundedAmount(order) : 0;
    const net = this.getNetAmount ? this.getNetAmount(order) : original;
    return `Original: ${original.toFixed(2)}\nRefunded: -${refunded.toFixed(2)}\nNet: ${net.toFixed(2)}`;
  }

  getPaymentTooltip(order: Order): string {
    if (!this.hasRefunds || !this.hasRefunds(order)) {
      return `Paid: ${order.totalPaid?.toFixed(2) || '0.00'}`;
    }
    const paid = order.totalPaid || 0;
    const refunded = order.totalRefunded || 0;
    const net = paid - refunded;
    return `Original Payment: ${paid.toFixed(2)}\nRefunds: -${refunded.toFixed(2)}\nNet Paid: ${net.toFixed(2)}`;
  }

  getProfitTooltip(order: Order): string {
    if (order.totalCost == null || order.totalProfit == null) {
      return this.translate.instant('not_available');
    }
    const cost = order.totalCost;
    const profit = order.totalProfit;
    const margin = order.profitMargin != null ? order.profitMargin.toFixed(2) : this.translate.instant('not_available');
    const costLabel = this.translate.instant('order_total_cost');
    const profitLabel = this.translate.instant('order_total_profit');
    const marginLabel = this.translate.instant('order_profit_margin');
    return `${costLabel}: ${cost.toFixed(2)}\n${profitLabel}: ${profit.toFixed(2)}\n${marginLabel}: ${margin}%`;
  }

  getCombinedAmountTooltip(order: Order): string {
    const amountLabel = this.translate.instant('order_total_amount');
    const paidLabel = this.translate.instant('order_total_paid');
    
    let amountDetails = '';
    if (this.hasReturns && this.hasReturns(order)) {
      const original = order.totalAmount || 0;
      const refunded = this.getTotalRefundedAmount ? this.getTotalRefundedAmount(order) : 0;
      const net = this.getNetAmount ? this.getNetAmount(order) : original;
      amountDetails = `${amountLabel}:\n  ${this.translate.instant('original_amount')}: ${original.toFixed(2)}\n  ${this.translate.instant('refunded_amount')}: -${refunded.toFixed(2)}\n  ${this.translate.instant('net_amount')}: ${net.toFixed(2)}`;
    } else {
      amountDetails = `${amountLabel}: ${(order.totalAmount || 0).toFixed(2)}`;
    }
    
    let paidDetails = '';
    if (this.hasRefunds && this.hasRefunds(order)) {
      const paid = order.totalPaid || 0;
      const refunded = order.totalRefunded || 0;
      const net = paid - refunded;
      paidDetails = `${paidLabel}:\n  ${this.translate.instant('original_payment')}: ${paid.toFixed(2)}\n  ${this.translate.instant('total_refunds')}: -${refunded.toFixed(2)}\n  ${this.translate.instant('net_paid')}: ${net.toFixed(2)}`;
    } else {
      paidDetails = `${paidLabel}: ${(order.totalPaid || 0).toFixed(2)}`;
    }
    
    return `${amountDetails}\n\n${paidDetails}`;
  }

  clearFilters() {
    this.resetFilters();
  }

  formatOrderItemQty(orderItem: OrderItem): string {
    return formatLineQuantity(orderItem?.product, getOrderItemDisplayQuantity(orderItem));
  }

  getOrderItemMeasureUnit(orderItem: OrderItem): string {
    return getLineMeasureUnit(orderItem?.product, getOrderItemDisplayQuantity(orderItem));
  }

  formatOrderItemReturnedQty(orderItem: OrderItem): string {
    return formatLineQuantity(orderItem?.product, getOrderItemDisplayReturnedQuantity(orderItem));
  }

  formatOrderItemRemainingQty(orderItem: OrderItem): string {
    return formatLineQuantity(orderItem?.product, getOrderItemDisplayRemainingQuantity(orderItem));
  }

  hasReturnedQuantity(orderItem: OrderItem): boolean {
    return getOrderItemDisplayReturnedQuantity(orderItem) > 0;
  }

  getProductBadgeKey(product?: Product): string {
    return getProductTypeBadgeKey(product);
  }

  getProductBadgeSeverity(product?: Product): string {
    return getProductTypeBadgeSeverity(product);
  }

  getProductBadgeIcon(product?: Product): string {
    return getProductTypeBadgeIcon(product);
  }

  showOrderItemMeasureUnit(orderItem: OrderItem): boolean {
    return shouldShowLineMeasureUnit(orderItem?.product);
  }

}
