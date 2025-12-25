import { Category } from "./category";
import { Supplier } from "./supplier";
import { Warehouse } from "./warehouse";
import { OrderItem } from "./orderItem";
import { ProductAttribute } from "./productAttribute";
import { MeasureUnit } from "../enums/measure-condition.enum";

export type BarcodeType = 'EAN13' | 'EAN8' | 'CODE128' | 'CODE39' | 'UPC' | 'QR' | 'CUSTOM';

export class Product {
  [x: string]: any; 
  productId?: number;
  reference?: string;
  name?: string;
  description?: string;
  quantityAvailable?: number;
  buyingPrice?: number;
  buyingDate?: Date;
  sellingPrice?: number;
  costingMethod?: string;
  standardCost?: number;
  inventoryStatus?: string;
  productImage?:string;
  category?: Category;
  supplier?: Supplier;
  warehouse?: Warehouse;
  creationDate?: Date;

  // Barcode fields
  barcode?: string;
  barcodeType?: BarcodeType;
  barcodeGeneratedAt?: Date;
  qrCode?: string;
  qrCodeGeneratedAt?: Date;

  orderItemQuantity?: number;
  orderItemPricePerUnit?: number;

  purchaseItemQuantity?: number;
  purchaseItemPricePerUnit?: number;

  returnItemQuantity?: number;
  returnItemPricePerUnit?: number;

  returnItemReason?: string;
  returnItemCondition?: string;

  orderItem?: OrderItem;

  attributes?: ProductAttribute[];
  measureUnit?: MeasureUnit;
  deletable?: boolean;
}