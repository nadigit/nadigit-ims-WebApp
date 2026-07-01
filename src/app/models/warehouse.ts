import { Organization } from "./organization";

export class Warehouse {
    warehouseId?: number;
    name?: string;
    description?: string;
    city?: string;
    country?: string;
    address?: string;
    organization?: Organization;
    creationDate?: Date;
}

export interface WarehouseDeleteImpactItem {
  type: string;
  count: number;
  blocking: boolean;
}

export interface WarehouseDeleteImpact {
  warehouseId: number;
  warehouseName?: string;
  canDelete: boolean;
  blockingReasonKey?: string;
  impacts: WarehouseDeleteImpactItem[];
  totalCascadeRecords: number;
}

