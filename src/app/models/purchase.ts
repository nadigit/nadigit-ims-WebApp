import { Shop } from "./shop";
import { Supplier } from "./supplier";
import { PurchaseItem } from "./purchaseItem";
import { Payment } from "./payment";

export interface PurchaseAttachment {
    id: number;
    fileUrl: string;
    originalFilename?: string;
    contentType?: string;
    documentType?: string;
    notes?: string;
    uploadedAt: string;
    uploadedBy?: string;
}

export interface PurchaseAttachmentTypeConfig {
    code: string;
    required: boolean;
}

export class Purchase { 
    purchaseId?: number;
    supplier?: Supplier;
    purpose?: string;
    reference?: string;
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
    dutyFreeAmount?: number;
    taxAmount?: number;
    /** Decimal snapshot used by backend (e.g. 0.2 for 20%). */
    taxRateUsed?: number;
    creationDate?: Date;
    invoice?:string;
    shop?:Shop;
    payments?: Array<Payment>;
    /** Admin: where goods are received; backend resolves SKU rows in this warehouse. */
    receivingWarehouseId?: number;
} 
