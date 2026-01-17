import { Category } from "./category";
import { Supplier } from "./supplier";
import { Warehouse } from "./warehouse";
import { OrderItem } from "./orderItem";
import { ProductAttribute } from "./productAttribute";
import { MeasureUnit } from "../enums/measure-condition.enum";
import { ProductBatch } from "./productBatch";

export type BarcodeType = 'EAN13' | 'EAN8' | 'CODE128' | 'CODE39' | 'UPC' | 'QR' | 'CUSTOM';

export type ProductType = 'PRODUCT' | 'SERVICE';

export type ExpirationStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

export class Product {
  [x: string]: any; 
  productId?: number;
  reference?: string;
  name?: string;
  description?: string;
  productType?: ProductType; // New field: 'PRODUCT' or 'SERVICE' (default: 'PRODUCT')
  quantityAvailable?: number | null; // Base quantity (for reporting) - Changed to nullable for services
  netAvailableQuantity?: number | null; // Available quantity excluding approved write-offs (USE THIS for UI) - Changed to nullable for services
  buyingPrice?: number | null; // Changed to nullable for services
  buyingDate?: Date;
  sellingPrice?: number;
  costingMethod?: string;
  standardCost?: number;
  inventoryStatus?: string | null; // Nullable for services
  productImage?:string;
  category?: Category;
  supplier?: Supplier | null; // Optional for services
  warehouse?: Warehouse | null; // Optional for services
  creationDate?: Date;

  // Service-specific fields
  serviceProvider?: string | null; // Optional, for services
  estimatedDurationMinutes?: number | null; // Optional, for services
  serviceCategory?: string | null; // Optional, for services

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
  expirationDate?: Date | string | null; // Expiration date for products that expire (synced from earliest batch)
  expirationStatus?: ExpirationStatus; // Calculated expiration status from batches
  batches?: ProductBatch[]; // Optional, batches for this product (loaded separately)
}

/**
 * Warehouse-specific stock information for aggregated products
 */
export interface WarehouseStockInfo {
  warehouseId: number;
  warehouseName: string;
  quantityAvailable: number;
  netAvailableQuantity: number;
  inventoryStatus?: string;
  expirationDate?: string; // ISO date string
  productId: number; // Original product ID for navigation
}

/**
 * Aggregated product DTO (grouped by reference across warehouses)
 */
export interface AggregatedProduct {
  reference: string;
  name: string;
  description?: string;
  productType?: ProductType;
  category?: Category;
  supplier?: Supplier;
  sellingPrice: number;
  buyingPrice?: number;
  productImage?: string;
  measureUnit?: MeasureUnit;
  active: boolean;
  
  // Aggregated quantities
  totalQuantityAvailable: number;
  totalNetAvailableQuantity: number;
  overallInventoryStatus?: string;
  
  // Warehouse breakdown
  warehouseStocks: WarehouseStockInfo[];
  
  // Additional aggregated info
  warehouseCount: number;
  earliestExpirationDate?: string;
  latestExpirationDate?: string;
}

/**
 * Response for aggregated products endpoint
 */
export interface ProductsAggregatedResponse {
  products: AggregatedProduct[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  
  // Summary statistics
  totalProducts: number;
  totalLowStockProducts: number;
  totalOutStockProducts: number;
  totalInStockProducts: number;
}