import { Product } from '../models/product';

export type ExpirationStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

export interface ExpirationInfo {
  status: ExpirationStatus;
  daysUntilExpiration: number;
  expirationDate: string | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

/**
 * Get expiration status for a product
 * @param product Product object
 * @param warningDays Number of days before expiration to consider "expiring soon" (default: 7)
 * @returns ExpirationStatus
 */
export const getExpirationStatus = (
  product: Product,
  warningDays: number = 7
): ExpirationStatus => {
  if (!product.expirationDate) {
    return 'VALID'; // No expiration date = always valid
  }

  const expirationDate = new Date(product.expirationDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expirationDate.setHours(0, 0, 0, 0);

  if (expirationDate < today) {
    return 'EXPIRED';
  }

  const daysUntilExpiration = Math.ceil(
    (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiration <= warningDays) {
    return 'EXPIRING_SOON';
  }

  return 'VALID';
};

/**
 * Get days until expiration
 * @param product Product object
 * @returns Number of days (negative if expired, Infinity if no expiration date)
 */
export const getDaysUntilExpiration = (product: Product): number => {
  if (!product.expirationDate) {
    return Infinity;
  }

  const expirationDate = new Date(product.expirationDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expirationDate.setHours(0, 0, 0, 0);

  return Math.ceil(
    (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
};

/**
 * Get complete expiration information
 * @param product Product object
 * @param warningDays Number of days before expiration to consider "expiring soon"
 * @returns ExpirationInfo object
 */
export const getExpirationInfo = (
  product: Product,
  warningDays: number = 7
): ExpirationInfo => {
  const status = getExpirationStatus(product, warningDays);
  const daysUntilExpiration = getDaysUntilExpiration(product);

  return {
    status,
    daysUntilExpiration: daysUntilExpiration === Infinity ? 0 : daysUntilExpiration,
    expirationDate: product.expirationDate ? (typeof product.expirationDate === 'string' ? product.expirationDate : product.expirationDate.toISOString().split('T')[0]) : null,
    isExpired: status === 'EXPIRED',
    isExpiringSoon: status === 'EXPIRING_SOON',
  };
};

/**
 * Format expiration date for display
 * @param expirationDate ISO date string, Date object, or null
 * @returns Formatted date string or null
 */
export const formatExpirationDate = (expirationDate: string | Date | null | undefined): string | null => {
  if (!expirationDate) {
    return null;
  }

  const date = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
  if (isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Get expiration status severity for PrimeNG components
 * @param status ExpirationStatus
 * @returns PrimeNG severity string
 */
export const getExpirationSeverity = (status: ExpirationStatus): string => {
  switch (status) {
    case 'EXPIRED':
      return 'danger';
    case 'EXPIRING_SOON':
      return 'warn';
    case 'VALID':
      return 'success';
    default:
      return 'info';
  }
};

/**
 * Get expiration status icon for PrimeNG components
 * @param status ExpirationStatus
 * @returns PrimeNG icon string
 */
export const getExpirationIcon = (status: ExpirationStatus): string => {
  switch (status) {
    case 'EXPIRED':
      return 'pi pi-exclamation-triangle';
    case 'EXPIRING_SOON':
      return 'pi pi-clock';
    case 'VALID':
      return 'pi pi-check-circle';
    default:
      return 'pi pi-info-circle';
  }
};

