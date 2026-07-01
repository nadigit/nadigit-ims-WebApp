export class Category {
    categoryId?: number;
    categoryName?: string;
    description?: string;
    costingMethod?: string;
    creationDate?: Date;
    /** Optional image URL (served from /api/uploads/categories/...). */
    categoryImage?: string;
}

export interface CategoryDeleteImpactItem {
  type: string;
  count: number;
  blocking: boolean;
}

export interface CategoryDeleteImpact {
  categoryId: number;
  categoryName?: string;
  canDelete: boolean;
  blockingReasonKey?: string;
  impacts: CategoryDeleteImpactItem[];
  totalCascadeRecords: number;
}

