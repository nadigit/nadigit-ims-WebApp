import { firstValueFrom } from "rxjs";
import { Product } from "../models/product";
import { AppConfigurationService } from "../services/app-configuration.service";

export function getSeverity(status: any) {
    switch (status) {
        case false:
            return 'danger';

        case true:
            return 'success';

        case 'new':
            return 'info';

        case 'negotiation':
            return 'warning';

        case 'renewal':
            return null;

        default:
            return '';
    }
}

export const measureUnits = [
    { value: 'UNIT', label: 'UNIT' },
    { value: 'KG', label: 'KG' },
    { value: 'LITER', label: 'LITER' },
    { value: 'PIECE', label: 'PIECE' },
    { value: 'BOX', label: 'BOX' },
    { value: 'METER', label: 'METER' }
];
export const attributeTypes = [
    { label: 'String', value: 'STRING' },
    { label: 'Integer', value: 'INTEGER' },
    { label: 'Double', value: 'DOUBLE' },
    { label: 'Boolean', value: 'BOOLEAN' }
];

export function getInventorySeverity(status: string): string {
    switch (status) {
        case 'INSTOCK': return 'success';
        case 'LOWSTOCK': return 'warning';
        case 'OUTOFSTOCK': return 'danger';
        default: return 'info';
    }
}

export function getQuantitySeverity(quantity: number, lowStockThreshold: number): string {
    if (quantity === undefined || quantity === null) return 'info';
    if (quantity <= 0) return 'danger';
    if (quantity < lowStockThreshold) return 'warning';
    return 'success';
}


export function getMeasureUnit(unit: string, quantity: number): string {
    if (!unit) return 'UNIT'; // fallback

    const pluralizable = ['UNIT', 'PIECE', 'BOX', 'METER'];

    if (quantity > 1 && pluralizable.includes(unit)) {
        return `${unit}_plural`;
    }

    return unit;
}



export function getProfitClass(product: any): string {
    const profit = calculateProfit(product);
    return profit >= 0.3 ? 'text-green-500 font-semibold' :
        profit >= 0.1 ? 'text-blue-500' : 'text-orange-500';
}

export function calculateProfit(product: Product): number {
    if (!product.sellingPrice || !product.buyingPrice) return 0;
    return (product.sellingPrice - product.buyingPrice) / product.buyingPrice;
}

export async function getLowStockThreshold(configService: AppConfigurationService): Promise<number> {
    let threshold: any;
    try {
      const value = await firstValueFrom(await configService.getConfiguration('lowStockThreshold'));

      threshold = (value !== undefined && value !== null && typeof value === 'object' && 'value' in value)
        ? Number((value as { value: any }).value)
        : 10;
      return threshold;
    } catch (error) {
      console.error('Error fetching low stock threshold:', error);
      threshold = 10; // fallback value
      return threshold;
    }
  }

  export function displayAttributeValue(attr: any): string {
    if (!attr) return '';
    switch (attr.attributeType) {
      case 'BOOLEAN':
        return attr.booleanValue ? 'Yes' : 'No';
      case 'INTEGER':
        return attr.intValue?.toString() || '';
      case 'DOUBLE':
        return attr.doubleValue?.toFixed(2) || '';
      default:
        return attr.stringValue || '';
    }
  }

/**
 * Get available quantity for a product (net quantity excluding write-offs)
 * Use netAvailableQuantity if available, otherwise fallback to quantityAvailable
 */
export function getAvailableQuantity(product: Product): number {
  if (product.netAvailableQuantity !== undefined && product.netAvailableQuantity !== null) {
    return product.netAvailableQuantity;
  }
  return product.quantityAvailable ?? 0;
}

/**
 * Check if product has write-offs (net quantity < base quantity)
 */
export function hasWriteOffs(product: Product): boolean {
  if (product.netAvailableQuantity === undefined || product.netAvailableQuantity === null) {
    return false;
  }
  if (product.quantityAvailable === undefined || product.quantityAvailable === null) {
    return false;
  }
  return product.netAvailableQuantity < product.quantityAvailable;
}

/**
 * Get write-off quantity (base quantity - net quantity)
 */
export function getWriteOffQuantity(product: Product): number {
  if (!hasWriteOffs(product)) {
    return 0;
  }
  return (product.quantityAvailable ?? 0) - (product.netAvailableQuantity ?? 0);
}