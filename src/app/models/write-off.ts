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
  ORDER_RETURN = 'ORDER_RETURN',
  PURCHASE_RETURN = 'PURCHASE_RETURN',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
  EXPIRATION = 'EXPIRATION',
  DAMAGE_INCIDENT = 'DAMAGE_INCIDENT',
  THEFT = 'THEFT',
  QUALITY_CONTROL = 'QUALITY_CONTROL'
}

export interface InventoryWriteOff {
  writeOffId?: number;
  reference?: string; // e.g., "WOF-2026-00001"
  product?: Product;
  warehouse?: Warehouse;
  batch?: ProductBatch | null; // Optional - if from specific batch
  quantity: number;
  condition: ItemCondition | string; // DAMAGED, UNUSABLE, LOST, EXPIRED
  sourceType: WriteOffSourceType | string; // ORDER_RETURN, PURCHASE_RETURN, MANUAL_ADJUSTMENT, etc.
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

