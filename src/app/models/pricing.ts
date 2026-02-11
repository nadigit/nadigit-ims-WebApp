export interface PriceListDTO {
  id?: number;
  name: string;
  description?: string;
  active: boolean;
  priority: number;
}

export interface PriceListItemDTO {
  id?: number;
  priceListId: number;
  productId: number;
  productName?: string;
  minQty: number;
  maxQty?: number | null;
  unitPrice: number;
  active: boolean;
}

export interface CustomerPriceOverrideDTO {
  id?: number;
  customerId: number;
  productId: number;
  productName?: string;
  unitPrice: number;
  active: boolean;
  validFrom?: string | Date | null;
  validTo?: string | Date | null;
  notes?: string | null;
}
