export class Supplier {
    supplierId?: number;
    name?: string;
    email?: string;
    phoneNumber?: string;
    country?: string;
    city?: string;
    address?: string;
    creationDate?: Date;
}

export interface SupplierDeleteImpactItem {
  type: string;
  count: number;
  blocking: boolean;
}

export interface SupplierDeleteImpact {
  supplierId: number;
  supplierName?: string;
  canDelete: boolean;
  forceable: boolean;
  blockingReasonKey?: string;
  impacts: SupplierDeleteImpactItem[];
  totalCascadeRecords: number;
}

