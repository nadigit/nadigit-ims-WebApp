import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { LazyLoadEvent } from 'primeng/api';
import { Payment } from 'src/app/models/payment';
import { getPaymentMethodLabel, getPaymentMethodSeverity, getPaymentMethodIcon, paymentMethodOptions } from 'src/app/shared/payment-utils';
import { ReconciliationValidationService } from 'src/app/services/reconciliation-validation.service';

@Component({
  selector: 'app-payments-table',
  templateUrl: './payments-table.component.html',
  styleUrls: ['./payments-table.component.css']
})
export class PaymentsTableComponent implements OnInit {
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
  @Input() paymentReconciliationStatuses: Map<number, any> = new Map(); // Map of paymentId -> reconciliation status
  @Input() customers: any[] = []; // Customers for filtering (for incoming payments)
  @Input() suppliers: any[] = []; // Suppliers for filtering (for outgoing payments)
  @Input() getCustomerDisplayName?: (customer: any) => string; // Function to get customer display name
  @Input() getSupplierDisplayName?: (supplier: any) => string; // Function to get supplier display name
  @Input() isExporting: boolean = false; // Export loading state
  @Input() exportProgress: string = ''; // Export progress message

  // Filter properties
  selectedPaymentStatus: string | null = null;
  selectedPaymentMethod: string | null = null;
  selectedCustomer: any = null;
  selectedSupplier: any = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  
  paymentStatuses: any[] = [];
  paymentMethods: any[] = [];

  constructor(private reconciliationValidationService: ReconciliationValidationService) {
    this.initializePaymentFilters();
  }

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
  @Output() exportPdfEvent = new EventEmitter<void>();
  @Output() exportExcelEvent = new EventEmitter<void>();
  @Output() filterChangeEvent = new EventEmitter<any>();

  onSelectionChange(event: Payment[]) {
    this.selectedPaymentsChange.emit(event); // this triggers parent two-way binding
  }

  onLazyLoad(event: LazyLoadEvent) {
    // emit context using 'as any' to avoid type errors
    this.lazyLoadEvent.emit({ ...event, context: this.context } as any);
  }

  requiresReconciliation(paymentMethod: string | null | undefined): boolean {
    return this.reconciliationValidationService.requiresReconciliation(paymentMethod);
  }

  getReconciliationStatus(payment: Payment): string | null {
    if (!payment.paymentId || !this.requiresReconciliation(payment.paymentMethod)) {
      return null; // No reconciliation required
    }
    const status = this.paymentReconciliationStatuses.get(payment.paymentId);
    if (!status) {
      return 'unknown'; // Status not loaded yet
    }
    return status.allReconciled ? 'reconciled' : 'unreconciled';
  }

  isPaymentNotSettled(payment: Payment): boolean {
    // A payment is considered "not settled" if its status is not SETTLED
    // This allows editing/deleting payments regardless of when they were created,
    // as long as they haven't been settled yet
    return payment.paymentStatus !== 'SETTLED';
  }

  applyGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value.trim();
    this.onGlobalFilter.emit({ globalFilter: value, context: this.context });
  }


  getPaymentMethodLabel(paymentMethod: string) {
    return getPaymentMethodLabel(paymentMethod);
  }

  getPaymentMethodSeverity(paymentMethod: string): string {
    return getPaymentMethodSeverity(paymentMethod);
  }

  getPaymentMethodIcon(paymentMethod: string): string {
    return getPaymentMethodIcon(paymentMethod);
  }

  // ⚠️ NEW: Check if payment is part of a multi-order/purchase payment
  isMultiPayment(payment: Payment): boolean {
    return !!(payment as any).isMultiPayment;
  }

  // ⚠️ NEW: Get payment count for multi-payment transactions
  getPaymentCount(payment: Payment): number {
    return (payment as any).paymentCount || 1;
  }

  ngOnInit() {
    // Filters are initialized in constructor
  }

  private initializePaymentFilters() {
    // Payment statuses - synced with backend enum: PENDING, SETTLED, FAILED, REFUNDED, PARTIAL_REFUND
    this.paymentStatuses = [
      { label: 'Pending', value: 'PENDING' },
      { label: 'Settled', value: 'SETTLED' },
      { label: 'Failed', value: 'FAILED' },
      { label: 'Refunded', value: 'REFUNDED' },
      { label: 'Partial Refund', value: 'PARTIAL_REFUND' },
    ];

    // Payment methods
    this.paymentMethods = paymentMethodOptions.map(opt => ({
      label: opt.label,
      value: opt.value
    }));
  }

  onFilterChange() {
    // Emit filter change event to parent component
    // The parent component will handle the actual filtering since it uses lazy loading
    this.filterChangeEvent.emit({
      paymentStatus: this.selectedPaymentStatus,
      paymentMethod: this.selectedPaymentMethod,
      customer: this.selectedCustomer,
      supplier: this.selectedSupplier,
      startDate: this.startDate,
      endDate: this.endDate
    });
  }

  clearFilters() {
    this.selectedPaymentStatus = null;
    this.selectedPaymentMethod = null;
    this.selectedCustomer = null;
    this.selectedSupplier = null;
    this.startDate = null;
    this.endDate = null;
    
    this.onFilterChange();
  }

}
