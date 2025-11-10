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
  { label: 'payment_method_boe', value: 'BOE', icon: 'pi pi-file' }
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
    switch (method) {
        case 'CASH': return 'pi pi-money-bill';
        case 'CARD': return 'pi pi-credit-card';
        case 'TRANSFER': return 'pi pi-bank';
        case 'CHECK': return 'pi pi-file';
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