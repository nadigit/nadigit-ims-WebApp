import { Customer } from "./customer";
import { Order } from "./order";

export class Payment { 
    paymentId?: number;
    order?: Order;
    customer?: Customer;
    amount?: number;
    paymentMethod?: string;
    checkNumber?: string;
    checkExpirationDate?: Date | string;
    boeNumber?: string;
    boeExpirationDate?: Date | string;
    transactionId?: string;
    paymentDate?: Date | string;
    notes?: string;
    // refunded?: boolean;
    // refundAmount?: number;
    // refundDate?: Date | string;
    createdBy?: string;
    creationDate?: Date;
} 
