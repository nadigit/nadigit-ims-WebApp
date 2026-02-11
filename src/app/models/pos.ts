export interface POSSessionDTO {
  sessionId: number;
  shop: { shopId: number; shopName: string };
  cashRegisterSession?: { sessionId: number };
  userId: string;
  username: string;
  startedAt: string;
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
  quantityAvailable: number; // This now contains NET quantity from backend (excluding approved write-offs)
  inventoryStatus?: string; // Based on net quantity
  categoryName?: string;
  warehouseName?: string;
  barcode?: string;
  imageUrl?: string;
  measureUnit?: string;
  active?: boolean;
}

export interface POSCartItemDTO {
  cartItemId: number;
  productId: number;
  productReference: string;
  productName: string;
  quantity: number;
  pricePerUnit: number;
  subtotal: number;
  quantityAvailable: number;
  notes?: string;
}

export type POSCartStatus = 'ACTIVE' | 'HOLD' | 'COMPLETED' | 'CANCELLED';

export type DiscountType = 'Amount' | 'Percentage';

export interface POSCartDTO {
  cartId: number;
  posSessionId: number;
  customerId?: number;
  transportAmount?: number;
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
  payments: PaymentInfo[];
  notes?: string;
  printReceipt?: boolean;
}

export interface ReceiptItem {
  productName: string;
  quantity: number;
  pricePerUnit: number;
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
  totalAmount: number;
  payments: PaymentLine[];
  change: number;
  receiptNumber: string;
  footerMessage?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}


