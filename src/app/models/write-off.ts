import { Product } from './product';
import { Warehouse } from './warehouse';
import { ProductBatch } from './productBatch';
import { ItemCondition } from '../enums/item-condition.enum';

export enum WriteOffStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum WriteOffSourceType {
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
  ORDER_RETURN = 'ORDER_RETURN',
  PURCHASE_RETURN = 'PURCHASE_RETURN',
  EXPIRATION = 'EXPIRATION',
  DAMAGE_INCIDENT = 'DAMAGE_INCIDENT',
  THEFT = 'THEFT',
  QUALITY_CONTROL = 'QUALITY_CONTROL'
}

// Request interface for creating write-offs
export interface CreateWriteOffRequest {
  productId: number;
  warehouseId: number;
  quantity: number;
  condition: ItemCondition | string;
  batchId?: number;
  reason?: string;
  sourceType?: WriteOffSourceType | string;
  notes?: string;
}

export interface InventoryWriteOff {
  writeOffId?: number;
  reference?: string; // e.g., "WOF-2026-00001"
  // Request fields (IDs)
  productId?: number;
  warehouseId?: number;
  batchId?: number;
  // Response fields (full details)
  productName?: string;
  productReference?: string;
  warehouseName?: string;
  batchNumber?: string;
  batchExpirationDate?: string;
  // Legacy fields (for backward compatibility)
  product?: Product;
  warehouse?: Warehouse;
  batch?: ProductBatch | null;
  // Common fields
  quantity: number;
  /** Human-readable quantity from API (kg, liters, MAD). */
  displayQuantity?: number;
  /** Formatted quantity + unit from API. */
  quantityLabel?: string;
  condition: ItemCondition | string; // DAMAGED, UNUSABLE, LOST, EXPIRED
  sourceType: WriteOffSourceType | string; // MANUAL_ADJUSTMENT, ORDER_RETURN, etc.
  writeOffCost?: number; // Total cost (quantity * buying price)
  reason?: string;
  sourceReference?: string; // Reference to return/order
  sourceId?: number; // ID of source document
  status?: WriteOffStatus | string; // PENDING, APPROVED, REJECTED
  writeOffDate?: Date | string; // ISO date
  approvedBy?: string;
  approvedDate?: Date | string; // ISO datetime
  rejectedBy?: string;
  rejectedDate?: Date | string; // ISO datetime
  rejectionReason?: string;
  notes?: string;
  createdBy?: string;
  creationDate?: Date | string; // ISO datetime
  lastModifiedDate?: Date | string; // ISO datetime
}

export interface PagedWriteOffResponse {
  content: InventoryWriteOff[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

