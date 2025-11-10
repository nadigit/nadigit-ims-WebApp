import { Customer } from "./customer";
import { Order } from "./order";
import { Purchase } from "./purchase";
import { Supplier } from "./supplier";

export class Payment { 
    paymentId?: number;
    order?: Order;
    purchase?: Purchase;
    customer?: Customer;
    amount?: number;
    paymentMethod?: string;
    paymentStatus?: string;
    checkNumber?: string;
    checkExpirationDate?: Date | string;
    boeNumber?: string;
    boeExpirationDate?: Date | string;
    transactionId?: string;
    paymentDate?: Date | string;
    notes?: string;
    createdBy?: string;
    creationDate?: Date;
    customerId?: number;
    orderId?: number;
    purchaseId?: number;
    purchaseReference?: string;
    supplierId?: number;
    supplier?: Supplier;
    receiptStatus?: string; // e.g., "Pending", "Generated", "Failed"
    receiptNumber?: string; // Unique identifier for the receipt
    hasReceipt?: boolean; // Indicates if a receipt has been generated for this payment
    direction?: 'INCOMING' | 'OUTGOING'; // Payment direction
} 
