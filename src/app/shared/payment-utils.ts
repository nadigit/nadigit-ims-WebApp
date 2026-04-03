import { Payment } from 'src/app/models/payment';

export interface PaymentMethodOption {
  label: string;  // translation key
  value: string;  // actual value
  icon: string;   // icon name
}

export const paymentMethodOptions: PaymentMethodOption[] = [
  { label: 'payment_method_cash', value: 'Cash', icon: 'pi pi-money-bill' },
  { label: 'payment_method_card', value: 'Card', icon: 'pi pi-credit-card' },
  { label: 'payment_method_check', value: 'Check', icon: 'pi pi-file-edit' },
  { label: 'payment_method_transfer', value: 'Transfer', icon: 'pi pi-bank' },
  { label: 'payment_method_boe', value: 'BOE', icon: 'pi pi-file' },
  { label: 'payment_method_digital_wallet', value: 'DIGITAL_WALLET', icon: 'pi pi-mobile' },
  { label: 'payment_method_credit', value: 'Credit', icon: 'pi pi-wallet' }
];

/**
 * Utility functions to get label/icon/severity
 */
export function getPaymentMethodOption(value: string): PaymentMethodOption | undefined {
  return paymentMethodOptions.find(opt => opt.value.toLowerCase() === value?.toLowerCase());
}

export function getPaymentMethodLabel(value: string): string {
  return getPaymentMethodOption(value)?.label || 'N/A';
}


export function getPaymentMethodSeverity(method: string): string {
    switch (method?.toLowerCase()) {
        case 'cash':
            return 'success';
        case 'credit':
            return 'warning';
        case 'check':
            return 'help';
        case 'transfer':
            return 'info';
        default:
            return 'danger';
    }
}

export function getPaymentMethodIcon(method: string): string {
    const option = getPaymentMethodOption(method);
    if (option) {
        return option.icon;
    }
    // Fallback for backward compatibility
    switch (method?.toUpperCase()) {
        case 'CASH': return 'pi pi-money-bill';
        case 'CARD': return 'pi pi-credit-card';
        case 'TRANSFER': return 'pi pi-bank';
        case 'CHECK': return 'pi pi-file-edit';
        case 'BOE': return 'pi pi-file';
        case 'DIGITAL_WALLET': return 'pi pi-mobile';
        case 'CREDIT': return 'pi pi-wallet';
        default: return 'pi pi-wallet';
    }
}

export function getPaymentStatusSeverity(status: string): string {
    switch (status) {
        // case 'PAID': return 'success';
        // case 'PARTIAL': return 'info';
        // case 'PENDING': return 'warning';
        case 'OVERDUE': return 'danger';
        case 'SETTLED': return 'success';
        case 'PENDING': return 'warning';
        case 'FAILED': return 'danger';
        case 'REFUNDED': return 'info';
        default: return '';
    }
}

export function getPaymentStatusIcon(status: string): string {
    switch (status?.toUpperCase()) {
        case 'PAID': return 'pi pi-check';
        case 'PARTIAL': return 'pi pi-clock';
        case 'PENDING': return 'pi pi-times';
        case 'OVERDUE': return 'pi pi-ban';
        default: return 'pi pi-info-circle';
    }
}

function toTimelineDate(d: unknown): Date | null {
  if (d == null || d === '') {
    return null;
  }
  const dt = d instanceof Date ? d : new Date(d as string);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Check, BOE, and bank transfers typically have a pending clearance step before settlement. */
export function isDeferredPaymentMethod(method?: string | null): boolean {
  const m = (method || '').toLowerCase();
  return m === 'check' || m === 'boe' || m === 'transfer';
}

export interface PaymentTimelineEvent {
  status: string;
  date: Date | string | null;
  icon: string;
}

/**
 * Milestones for payment details timeline (sales & purchases), aligned with backend payment statuses.
 */
export function buildPaymentTimelineEvents(payment: Payment): PaymentTimelineEvent[] {
  const status = String(payment.paymentStatus ?? '').trim().toUpperCase();
  const creation = toTimelineDate(payment.creationDate);
  const payDate = toTimelineDate(payment.paymentDate);
  const anchor = creation ?? payDate;
  const deferred = isDeferredPaymentMethod(payment.paymentMethod);

  if (status === 'FAILED') {
    return [
      { status: 'RECORDED', date: anchor, icon: 'pi pi-inbox' },
      { status: 'FAILED', date: payDate ?? anchor, icon: 'pi pi-times-circle' }
    ].filter(e => e.date != null || e.status === 'RECORDED');
  }

  if (status === 'VOIDED') {
    return [
      { status: 'RECORDED', date: anchor, icon: 'pi pi-inbox' },
      { status: 'VOIDED', date: payDate ?? anchor, icon: 'pi pi-ban' }
    ].filter(e => e.date != null || e.status === 'RECORDED');
  }

  if (status === 'REFUNDED') {
    const events: PaymentTimelineEvent[] = [
      { status: 'RECORDED', date: anchor, icon: 'pi pi-inbox' },
      {
        status: 'PENDING',
        date: deferred ? (payDate ?? anchor) : null,
        icon: 'pi pi-clock'
      },
      { status: 'SETTLED', date: payDate ?? anchor, icon: 'pi pi-check-circle' },
      { status: 'REFUNDED', date: payDate ?? anchor, icon: 'pi pi-replay' }
    ];
    return events.filter(e => e.date != null || e.status === 'RECORDED');
  }

  if (status === 'PARTIAL_REFUND') {
    const events: PaymentTimelineEvent[] = [
      { status: 'RECORDED', date: anchor, icon: 'pi pi-inbox' },
      {
        status: 'PENDING',
        date: deferred ? (payDate ?? anchor) : null,
        icon: 'pi pi-clock'
      },
      { status: 'SETTLED', date: payDate ?? anchor, icon: 'pi pi-check-circle' },
      { status: 'PARTIAL_REFUND', date: payDate ?? anchor, icon: 'pi pi-percentage' }
    ];
    return events.filter(e => e.date != null || e.status === 'RECORDED');
  }

  const events: PaymentTimelineEvent[] = [
    { status: 'RECORDED', date: anchor, icon: 'pi pi-inbox' },
    {
      status: 'PENDING',
      date: status === 'PENDING' || (status === 'SETTLED' && deferred) ? (payDate ?? anchor) : null,
      icon: 'pi pi-clock'
    },
    {
      status: 'SETTLED',
      date: status === 'SETTLED' ? (payDate ?? anchor) : null,
      icon: 'pi pi-check-circle'
    }
  ];
  return events.filter(e => e.date != null || e.status === 'RECORDED');
}

export function isPaymentTimelineStepActive(payment: Payment | null, event: PaymentTimelineEvent): boolean {
  if (!payment?.paymentStatus) {
    return false;
  }
  const s = String(payment.paymentStatus).trim().toUpperCase();
  const ev = event.status.toUpperCase();
  return s === ev;
}