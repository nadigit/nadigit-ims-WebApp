export interface POSSessionDTO {
  sessionId: number;
  shop?: { shopId: number; shopName: string };
  /** Present on history API rows */
  shopId?: number;
  shopName?: string;
  cashRegisterSession?: { sessionId: number };
  /** Flat id from history API */
  cashRegisterSessionId?: number;
  userId: string;
  username: string;
  startedAt: string;
  endedAt?: string;
  active: boolean;
  totalTransactions: number;
  totalSales: number;
  totalCashSales: number;
  totalCardSales: number;
  totalOtherSales: number;
}

export interface POSProductDTO {
  productId: number;
  reference: string;
  name: string;
  description?: string;
  buyingPrice?: number;
  sellingPrice: number;
  quantityAvailable: number; // Storage units (net, excluding approved write-offs)
  displayQuantityAvailable?: number;
  inventoryStatus?: string; // Based on net quantity
  categoryName?: string;
  warehouseName?: string;
  barcode?: string;
  imageUrl?: string;
  measureUnit?: string;
  stockTrackingMode?: string;
  quantityPrecision?: number;
  active?: boolean;
  productType?: string; // 'PRODUCT' | 'SERVICE' — services have no stock and are always sellable
}

export interface POSCartItemDTO {
  cartItemId: number;
  productId: number;
  productReference: string;
  productName: string;
  /** Storage quantity (internal). */
  quantity: number;
  /** Human-readable quantity for fractional/prepaid lines. */
  displayQuantity?: number;
  pricePerUnit: number;
  subtotal: number;
  quantityAvailable: number;
  displayQuantityAvailable?: number;
  measureUnit?: string;
  stockTrackingMode?: string;
  notes?: string;
  categoryId?: number;
  /** CSV of selected line_option ids (components/cuts) on this cart line. */
  selectedOptionIds?: string;
  /** Portion of a divisible unit sold (1 = whole, 0.5 = half, ...). */
  portionFraction?: number;
}

export type POSCartStatus = 'ACTIVE' | 'HOLD' | 'COMPLETED' | 'CANCELLED';

export type DiscountType = 'Amount' | 'Percentage';

export interface POSCartDTO {
  cartId: number;
  posSessionId: number;
  customerId?: number;
  transportAmount?: number;
  additionalChargesAmount?: number;
  customerName?: string;
  items: POSCartItemDTO[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  discountType?: DiscountType;
  taxEnabled: boolean;
  status: POSCartStatus;
  createdAt: string;
  notes?: string;
  reservationConflictDetected?: boolean;
  reservationConflictMessage?: string | null;
}

export type PaymentMethod =
  | 'Cash'
  | 'Card'
  | 'Transfer'
  | 'Check'
  | 'BOE'
  | 'DIGITAL_WALLET'
  | 'Credit';

export interface PaymentInfo {
  method: PaymentMethod;
  amount: number;
  bankAccountId?: number;
  checkNumber?: string;
  checkExpirationDate?: string;
  boeNumber?: string;
  boeExpirationDate?: string;
  transactionReference?: string;
  notes?: string;
}

export interface POSCheckoutDTO {
  cartId: number;
  customerId?: number;
  transportAmount?: number;
  additionalChargesAmount?: number;
  payments: PaymentInfo[];
  notes?: string;
  printReceipt?: boolean;
}

export interface ReceiptItem {
  productName: string;
  quantity: number;
  quantityDisplay?: number;
  quantityLabel?: string;
  pricePerUnit: number;
  unitPriceSuffix?: string;
  subtotal: number;
}

export interface PaymentLine {
  method: string;
  amount: number;
}

export interface POSReceiptDTO {
  orderReference: string;
  shopName: string;
  shopAddress?: string;
  transactionDate: string;
  cashierName: string;
  customerName: string;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  transportAmount?: number;
  additionalChargesAmount?: number;
  totalAmount: number;
  payments: PaymentLine[];
  change: number;
  receiptNumber: string;
  footerMessage?: string;
  primaryPaymentId?: number;
  receiptDocNumber?: string;
  receiptFileUrl?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}


