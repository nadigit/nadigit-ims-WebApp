import { Product } from "./product";
import { Warehouse } from "./warehouse";
import { Purchase } from "./purchase";
import { Order } from "./order";
import { WarehouseTransfer } from "./warehouseTransfer";

export enum StockMovementType {
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  ADJUSTMENT = 'ADJUSTMENT',
  RETURN = 'RETURN',
  DAMAGE = 'DAMAGE',
  EXPIRY = 'EXPIRY'
}

export interface StockMovement {
  movementId?: number;
  product?: Product;
  warehouse?: Warehouse;
  movementType?: StockMovementType | string;
  quantity?: number;
  previousQuantity?: number;
  newQuantity?: number;
  unitCost?: number;
  totalCost?: number;
  reference?: string;
  sourceDocumentType?: string; // 'PURCHASE', 'ORDER', 'WAREHOUSE_TRANSFER', etc.
  sourceDocumentId?: number;
  purchase?: Purchase;
  order?: Order;
  warehouseTransfer?: WarehouseTransfer;
  notes?: string;
  movementDate?: Date | string;
  performedBy?: string;
  creationDate?: Date | string;
}

export interface PagedStockMovementResponse {
  content: StockMovement[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

