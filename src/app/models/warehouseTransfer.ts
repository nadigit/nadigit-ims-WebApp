import { Warehouse } from "./warehouse";
import { Product } from "./product";

export enum TransferStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface TransferItem {
  transferItemId?: number;
  product: Product;
  quantity: number;
  notes?: string;
}

export interface WarehouseTransfer {
  transferId?: number;
  reference?: string;
  sourceWarehouse?: Warehouse;
  destinationWarehouse?: Warehouse;
  status?: TransferStatus | string;
  transferItems?: TransferItem[];
  transferDate?: Date | string;
  initiatedDate?: Date | string;
  completedDate?: Date | string;
  cancelledDate?: Date | string;
  notes?: string;
  createdBy?: string;
  creationDate?: Date | string;
  initiatedBy?: string;
  completedBy?: string;
  cancelledBy?: string;
}

export interface PagedTransferResponse {
  content: WarehouseTransfer[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

