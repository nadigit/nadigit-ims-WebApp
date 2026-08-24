import { firstValueFrom } from "rxjs";
import { Product } from "../models/product";
import { AppConfigurationService } from "../services/app-configuration.service";
import { QuantityScale } from "../utils/quantity-scale.util";
import { OrderItem } from "../models/orderItem";
import { PurchaseItem } from "../models/purchaseItem";
import { PurchaseReturnItem } from "../models/purchaseReturnItem";
import { InventoryWriteOff } from "../models/write-off";
import { POSCartItemDTO } from "../models/pos";
import { stockTrackingModeFrom } from "../enums/stock-tracking-mode.enum";
import { MeasureUnit } from "../enums/measure-condition.enum";

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

/**
 * Canonical stock-status rule — mirrors the backend `InventoryStatus.classify` so the products-list
 * badge agrees with the KPI header, the dashboard, and the NadiPilot briefing (all computed live).
 * Derives the status from current on-hand quantity, so a product at 0 units reads OUTOFSTOCK
 * ("rupture de stock") instead of a possibly-stale persisted status. Effective quantity is expressed
 * in display units (kg / L / MAD for fractional and prepaid products).
 */
export function resolveInventoryStatus(product: Product, lowStockThreshold: number): string {
    const qty = product?.quantityAvailable ?? 0;
    const effective = QuantityScale.toDisplayQuantity(product, qty);
    if (effective <= 0) return 'OUTOFSTOCK';
    if (effective <= lowStockThreshold) return 'LOWSTOCK';
    return 'INSTOCK';
}


export function getMeasureUnit(unit: string, quantity: number): string {
    if (!unit) return 'UNIT'; // fallback

    const pluralizable = ['UNIT', 'PIECE', 'BOX', 'METER'];

    if (quantity > 1 && pluralizable.includes(unit)) {
        return `${unit}_plural`;
    }

    return unit;
}

/** Format sellable stock for UI labels (quantity + unit key for translate pipe). */
export function formatProductStockLabel(product: Product): { quantity: string; unit: string } {
    const displayQty = getAvailableQuantity(product);
    const precision = QuantityScale.isFractional(product) ? QuantityScale.effectivePrecision(product) : 0;
    const quantity = precision > 0 ? displayQty.toFixed(precision) : String(Math.round(displayQty));
    const unit = getMeasureUnit(product.measureUnit || 'UNIT', displayQty);
    return { quantity, unit };
}

/** Convert warehouse stock integers to display units for fractional products. */
export function displayWarehouseStockQuantity(product: Product, storageQuantity: number | null | undefined): number {
    if (storageQuantity == null) {
        return 0;
    }
    if (QuantityScale.isFractional(product)) {
        return QuantityScale.toDisplayQuantity(product, storageQuantity);
    }
    return storageQuantity;
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
 * Sellable quantity for orders/POS: prefers `netAvailableQuantity` from the API when present
 * (aligned with admin setting `sales.stock.include.approved.writeoff.quantity`).
 */
export function getAvailableQuantity(product: Product): number {
  if (QuantityScale.isFractional(product)) {
    return QuantityScale.displayStock(product);
  }
  if (product.netAvailableQuantity !== undefined && product.netAvailableQuantity !== null) {
    return product.netAvailableQuantity;
  }
  return product.quantityAvailable ?? 0;
}

/**
 * Check if product has write-offs (net quantity < base quantity)
 */
export function hasWriteOffs(product: Product): boolean {
  if (QuantityScale.isFractional(product)) {
    const base = product.displayQuantityAvailable ?? QuantityScale.toDisplayQuantity(product, product.quantityAvailable ?? 0);
    const net = product.displayNetAvailableQuantity ?? QuantityScale.toDisplayQuantity(product, product.netAvailableQuantity ?? product.quantityAvailable ?? 0);
    return net < base;
  }
  if (product.netAvailableQuantity === undefined || product.netAvailableQuantity === null) {
    return false;
  }
  if (product.quantityAvailable === undefined || product.quantityAvailable === null) {
    return false;
  }
  return product.netAvailableQuantity < product.quantityAvailable;
}

export function getWriteOffQuantity(product: Product): number {
  if (QuantityScale.isFractional(product)) {
    if (!hasWriteOffs(product)) {
      return 0;
    }
    const base = product.displayQuantityAvailable ?? QuantityScale.toDisplayQuantity(product, product.quantityAvailable ?? 0);
    const net = product.displayNetAvailableQuantity ?? QuantityScale.toDisplayQuantity(product, product.netAvailableQuantity ?? product.quantityAvailable ?? 0);
    return Math.max(0, base - net);
  }
  if (!hasWriteOffs(product)) {
    return 0;
  }
  return (product.quantityAvailable ?? 0) - (product.netAvailableQuantity ?? 0);
}

export function buildOrderItemPayload(product: Product, lineQuantity: number, pricePerUnit: number, extra?: Partial<OrderItem>): OrderItem {
  const item: OrderItem = {
    product: product.productId != null ? ({ productId: product.productId } as Product) : product,
    pricePerUnit,
    ...extra,
  };
  if (QuantityScale.isFractional(product)) {
    item.displayQuantity = lineQuantity;
  } else {
    item.quantity = Math.max(1, Math.round(lineQuantity));
  }
  return item;
}

export function buildPurchaseItemPayload(product: Product, lineQuantity: number, buyingPrice: number, extra?: Partial<PurchaseItem>): PurchaseItem {
  const item: PurchaseItem = {
    product: product.productId != null ? ({ productId: product.productId } as Product) : product,
    buyingPrice,
    ...extra,
  };
  if (QuantityScale.isFractional(product)) {
    item.displayQuantity = lineQuantity;
  } else {
    item.quantityPurchased = Math.max(1, Math.round(lineQuantity));
  }
  return item;
}

export function lineQuantityStep(product?: Product | null): number {
  return QuantityScale.inputStep(product);
}

export function lineQuantityDecimals(product?: Product | null): number {
  return QuantityScale.effectivePrecision(product);
}

export function lineQuantityMin(product?: Product | null): number {
  return QuantityScale.isFractional(product) ? lineQuantityStep(product) : 1;
}

export function defaultLineQuantity(product?: Product | null): number {
  return lineQuantityMin(product);
}

export function formatLineQuantity(product: Product | null | undefined, quantity: number | null | undefined): string {
  if (quantity == null || Number.isNaN(quantity)) {
    return '0';
  }
  const decimals = lineQuantityDecimals(product);
  return decimals > 0 ? quantity.toFixed(decimals) : String(Math.round(quantity));
}

export function isPrepaidPool(product?: Product | null): boolean {
  return QuantityScale.isPrepaidPool(product);
}

export function getProductTypeBadgeKey(product?: Product | null): string {
  if (!product) {
    return 'product_type_product';
  }
  if (product.productType === 'SERVICE') {
    return 'product_type_service';
  }
  if (isPrepaidPool(product)) {
    return 'product_type_prepaid';
  }
  return 'product_type_product';
}

export function getProductTypeBadgeSeverity(product?: Product | null): string {
  if (product?.productType === 'SERVICE') {
    return 'purple';
  }
  if (isPrepaidPool(product)) {
    return 'warning';
  }
  return 'info';
}

export function getProductTypeBadgeIcon(product?: Product | null): string {
  if (product?.productType === 'SERVICE') {
    return 'pi pi-cog';
  }
  if (isPrepaidPool(product)) {
    return 'pi pi-wallet';
  }
  return 'pi pi-box';
}

export function shouldShowLineMeasureUnit(product?: Product | null): boolean {
  if (!product || isPrepaidPool(product)) {
    return false;
  }
  const unit = product.measureUnit || 'UNIT';
  if (product.productType === 'SERVICE') {
    return unit !== 'UNIT';
  }
  return unit !== 'UNIT' && unit !== 'PIECE';
}

export function getLineMeasureUnit(product: Product | null | undefined, quantity?: number): string {
  if (!shouldShowLineMeasureUnit(product)) {
    return '';
  }
  const qty = quantity ?? (product ? getAvailableQuantity(product) : 0);
  return getMeasureUnit(product?.measureUnit || 'UNIT', qty);
}

export function cartItemAsProduct(item: POSCartItemDTO): Product {
  return {
    stockTrackingMode: stockTrackingModeFrom(item.stockTrackingMode),
    measureUnit: (item.measureUnit as MeasureUnit) ?? MeasureUnit.UNIT,
  } as Product;
}

export function getCartItemDisplayQuantity(item: POSCartItemDTO): number {
  if (!item) {
    return 0;
  }
  if (item.displayQuantity != null) {
    return item.displayQuantity;
  }
  return QuantityScale.toDisplayQuantity(cartItemAsProduct(item), item.quantity ?? 0);
}

export function getCartItemDisplayStock(item: POSCartItemDTO): number {
  if (!item) {
    return 0;
  }
  const product = cartItemAsProduct(item);
  if (QuantityScale.isFractional(product)) {
    if (item.displayQuantityAvailable != null) {
      return item.displayQuantityAvailable;
    }
    return QuantityScale.toDisplayQuantity(product, item.quantityAvailable ?? 0);
  }
  return item.quantityAvailable ?? 0;
}

export function computeCartItemSubtotal(item: POSCartItemDTO): number {
  if (!item) {
    return 0;
  }
  const product = cartItemAsProduct(item);
  const unitPrice = item.pricePerUnit ?? (QuantityScale.isPrepaidPool(product)
    ? QuantityScale.prepaidCustomerUnitPrice(product)
    : 0);
  return QuantityScale.lineAmount(product, item.quantity ?? 0, unitPrice);
}

export function getOrderItemLineNetAmount(item: OrderItem): number {
  if (!item) {
    return 0;
  }
  if (item.lineNetAmount != null && item.lineNetAmount > 0) {
    return item.lineNetAmount;
  }
  if (item.subTotal != null && item.subTotal > 0) {
    return item.subTotal;
  }
  return QuantityScale.lineAmount(item.product, item.quantity ?? 0, item.pricePerUnit ?? 0);
}

export function getOrderItemLineGrossAmount(item: OrderItem): number {
  if (!item) {
    return 0;
  }
  if (item.lineGrossAmount != null && item.lineGrossAmount > 0) {
    return item.lineGrossAmount;
  }
  return getOrderItemLineNetAmount(item) + (item.lineTaxAmount ?? 0);
}

export function getOrderItemDisplayQuantity(item: OrderItem): number {
  if (!item) {
    return 0;
  }
  if (item.displayQuantity != null) {
    return item.displayQuantity;
  }
  return QuantityScale.toDisplayQuantity(item.product, item.quantity ?? 0);
}

export function getOrderItemDisplayReturnedQuantity(item: OrderItem): number {
  if (!item) {
    return 0;
  }
  if (item.displayReturnedQuantity != null) {
    return item.displayReturnedQuantity;
  }
  return QuantityScale.toDisplayQuantity(item.product, item.returnedQuantity ?? 0);
}

export function getOrderItemDisplayRemainingQuantity(item: OrderItem): number {
  if (item?.displayRemainingQuantity != null) {
    return item.displayRemainingQuantity;
  }
  return Math.max(0, getOrderItemDisplayQuantity(item) - getOrderItemDisplayReturnedQuantity(item));
}

export function getPurchaseItemDisplayQuantity(item: PurchaseItem): number {
  if (!item) {
    return 0;
  }
  if (item.displayQuantity != null) {
    return item.displayQuantity;
  }
  return QuantityScale.toDisplayQuantity(item.product, item.quantityPurchased ?? 0);
}

export function displayProductStockQuantity(product: Product | null | undefined): number {
  if (!product) {
    return 0;
  }
  if (QuantityScale.isFractional(product)) {
    if (product.displayQuantityAvailable != null) {
      return product.displayQuantityAvailable;
    }
    return QuantityScale.toDisplayQuantity(product, product.quantityAvailable ?? 0);
  }
  return product.quantityAvailable ?? 0;
}

export function getPurchaseItemLineNetAmount(item: PurchaseItem): number {
  if (!item) {
    return 0;
  }
  if (item.lineNetAmount != null && item.lineNetAmount > 0) {
    return item.lineNetAmount;
  }
  if (item.totalCost != null && item.totalCost > 0) {
    return item.totalCost;
  }
  return QuantityScale.lineAmount(item.product, item.quantityPurchased ?? 0, item.buyingPrice ?? 0);
}

export function getPurchaseItemLineGrossAmount(item: PurchaseItem): number {
  if (!item) {
    return 0;
  }
  if (item.lineGrossAmount != null && item.lineGrossAmount > 0) {
    return item.lineGrossAmount;
  }
  return getPurchaseItemLineNetAmount(item) + (item.lineTaxAmount ?? 0);
}

export function computePurchaseLineSubtotal(product: Product, displayQuantity: number, unitPrice: number): number {
  if (!product || !displayQuantity || !unitPrice) {
    return 0;
  }
  const storageQty = QuantityScale.isFractional(product)
    ? QuantityScale.toStorageQuantity(product, displayQuantity)
    : Math.max(1, Math.round(displayQuantity));
  return QuantityScale.lineAmount(product, storageQty, unitPrice);
}

export function getPurchaseItemDisplayReturnedQuantity(item: PurchaseItem): number {
  if (!item) {
    return 0;
  }
  if (item.displayReturnedQuantity != null) {
    return item.displayReturnedQuantity;
  }
  return QuantityScale.toDisplayQuantity(item.product, item.returnedQuantity ?? 0);
}

export function getPurchaseReturnItemDisplayQuantity(item: PurchaseReturnItem): number {
  if (!item) {
    return 0;
  }
  if (item.displayReturnedQuantity != null) {
    return item.displayReturnedQuantity;
  }
  return QuantityScale.toDisplayQuantity(item.product, item.returnedQuantity ?? 0);
}

export function getPurchaseReturnMaxDisplayQuantity(purchaseItem: PurchaseItem): number {
  if (!purchaseItem) {
    return 0;
  }
  const purchased = getPurchaseItemDisplayQuantity(purchaseItem);
  const returned = getPurchaseItemDisplayReturnedQuantity(purchaseItem);
  return Math.max(0, purchased - returned);
}

export function computePurchaseReturnCreditAmount(product: Product, displayQuantity: number, unitPrice: number): number {
  return computePurchaseLineSubtotal(product, displayQuantity, unitPrice);
}

export function buildPurchaseReturnItemPayload(
  product: Product,
  purchaseItem: PurchaseItem,
  displayQuantity: number,
  unitPrice: number,
  extra?: Partial<PurchaseReturnItem>
): PurchaseReturnItem {
  const storageQty = QuantityScale.isFractional(product)
    ? QuantityScale.toStorageQuantity(product, displayQuantity)
    : Math.max(1, Math.round(displayQuantity));
  const creditAmount = computePurchaseReturnCreditAmount(product, displayQuantity, unitPrice);
  return {
    product,
    purchaseItem,
    returnedQuantity: storageQty,
    displayReturnedQuantity: displayQuantity,
    creditAmount,
    refundAmount: creditAmount,
    ...extra,
  };
}

export function getWriteOffDisplayQuantity(writeOff: InventoryWriteOff): number {
  if (!writeOff) {
    return 0;
  }
  if (writeOff.displayQuantity != null) {
    return writeOff.displayQuantity;
  }
  return QuantityScale.toDisplayQuantity(writeOff.product, writeOff.quantity ?? 0);
}

export function getWriteOffQuantityDisplayLabel(writeOff: InventoryWriteOff): string {
  if (writeOff?.quantityLabel) {
    return writeOff.quantityLabel;
  }
  const product = writeOff?.product;
  const displayQty = getWriteOffDisplayQuantity(writeOff);
  const formatted = formatLineQuantity(product, displayQty);
  const unit = getLineMeasureUnit(product, displayQty);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function computeWriteOffEstimatedCost(
  product: Product,
  displayQuantity: number,
  unitCostPerDisplay?: number
): number {
  if (!product || !displayQuantity) {
    return 0;
  }
  const unitCost = unitCostPerDisplay ?? product.buyingPrice ?? 0;
  return computePurchaseLineSubtotal(product, displayQuantity, unitCost);
}

export function toWriteOffStorageQuantity(product: Product, displayQuantity: number): number {
  if (!product || !QuantityScale.isFractional(product)) {
    return Math.max(1, Math.round(displayQuantity));
  }
  return QuantityScale.toStorageQuantity(product, displayQuantity);
}