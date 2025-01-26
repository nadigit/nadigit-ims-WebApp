import { Shop } from "./shop";
import { Supplier } from "./supplier";
import { PurchaseItem } from "./purchaseItem";


export class Purchase { 
    id?: number;
    supplier?: Supplier;
    purpose?: string;
    dateOfPurchase?: Date | string;
    purchaseItems?: Array<PurchaseItem>;
    totalAmount?: number;
    paymentMethod?: string;
    checkNumber?: string;
    checkExpirationDate?: Date | string;
    boeNumber?: string;
    boeExpirationDate?: Date | string;
    discount?:number;
    taxEnabled?:boolean;
    creationDate?: Date;
    invoice?:string;
    shop?:Shop;
} 
