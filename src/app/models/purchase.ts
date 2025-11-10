import { Shop } from "./shop";
import { Supplier } from "./supplier";
import { PurchaseItem } from "./purchaseItem";
import { Payment } from "./payment";


export class Purchase { 
    purchaseId?: number;
    supplier?: Supplier;
    purpose?: string;
    dateOfPurchase?: Date | string;
    approvedDate?: Date | string;
    receivedDate?: Date | string;
    completionDate?: Date | string;
    cancelDate?: Date | string;
    purchaseItems?: Array<PurchaseItem>;
    totalAmount?: number;
    totalPaid?: number;
    purchaseStatus?: string;
    paymentStatus?: string;
    checkNumber?: string;
    checkExpirationDate?: Date | string;
    boeNumber?: string;
    boeExpirationDate?: Date | string;
    discount?:number;
    taxEnabled?:boolean;
    creationDate?: Date;
    invoice?:string;
    shop?:Shop;
    payments?: Array<Payment>;
} 
