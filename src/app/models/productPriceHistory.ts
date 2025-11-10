import { Supplier } from "./supplier";
import { Product } from "./product";

export class ProductPriceHistory { 
    productPriceHistoryId?: number;
    supplier?: Supplier;
    product?: Product;
    buyingPrice?: number;
    sellingPrice?: number
    effectiveDate?: Date | string;
    changedBy?: string;
    changeReason?: string;
    creationDate?: Date;
}