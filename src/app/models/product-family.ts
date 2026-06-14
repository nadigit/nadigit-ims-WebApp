
export interface ProductFamily {
  productFamilyId?: number;
  styleReference?: string;
  name?: string;
  description?: string;
  categoryId?: number;
  categoryName?: string;
  supplierId?: number;
  supplierName?: string;
  variantAxes?: string[];
  productImage?: string;
  active?: boolean;
  creationDate?: string;
  variantSkuCount?: number;
}

export interface ProductVariantLine {
  productId?: number;
  reference?: string;
  variantOptions?: Record<string, string>;
  variantSummary?: string;
  warehouseId?: number;
  warehouseName?: string;
  quantityAvailable?: number;
  netAvailableQuantity?: number;
  inventoryStatus?: string;
  sellingPrice?: number;
  buyingPrice?: number;
}

export interface ProductFamilyInventoryOverview {
  family: ProductFamily;
  totalQuantityAvailable: number;
  totalNetAvailableQuantity: number;
  overallInventoryStatus?: string;
  variantCombinationCount: number;
  warehouseLocationCount: number;
  variants: ProductVariantLine[];
}

export interface ProductFamilyInventoryOverviewPage {
  families: ProductFamilyInventoryOverview[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface CreateProductFamilyRequest {
  styleReference: string;
  name: string;
  description?: string;
  categoryId: number;
  supplierId?: number;
  variantAxes?: string[];
  productImage?: string;
}

export interface UpdateProductFamilyRequest {
  name?: string;
  description?: string;
  categoryId?: number;
  supplierId?: number;
  variantAxes?: string[];
  productImage?: string;
  active?: boolean;
}

export interface GenerateProductVariantsRequest {
  warehouseId?: number;
  optionValues: Record<string, string[]>;
  sellingPrice: number;
  buyingPrice: number;
  initialQuantity?: number;
}

export interface GenerateProductVariantsResponse {
  createdCount: number;
  skippedCount: number;
  variants: ProductVariantLine[];
}
