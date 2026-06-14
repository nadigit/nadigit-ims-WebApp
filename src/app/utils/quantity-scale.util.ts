import { MeasureUnit } from '../enums/measure-condition.enum';
import { StockTrackingMode, stockTrackingModeFrom } from '../enums/stock-tracking-mode.enum';
import { Product } from '../models/product';

/** Mirrors backend {@code QuantityScale} — storage integers vs display decimals. */
export class QuantityScale {
  static effectiveMode(product?: Product | null): StockTrackingMode {
    return stockTrackingModeFrom(product?.stockTrackingMode);
  }

  static isFractional(product?: Product | null): boolean {
    return this.effectiveMode(product) !== StockTrackingMode.DISCRETE_UNITS;
  }

  static isPrepaidPool(product?: Product | null): boolean {
    return this.effectiveMode(product) === StockTrackingMode.PREPAID_VALUE_POOL;
  }

  /** Face value per display currency unit (typically 1.0). Large selling prices are pool misconfiguration. */
  static prepaidCustomerUnitPrice(product?: Product | null): number {
    if (!product || !this.isPrepaidPool(product)) {
      return product?.sellingPrice ?? 0;
    }
    const sellingPrice = product.sellingPrice;
    if (sellingPrice == null || sellingPrice <= 0 || sellingPrice >= 100) {
      return 1.0;
    }
    return sellingPrice;
  }

  static defaultPrecision(mode: StockTrackingMode, measureUnit?: MeasureUnit): number {
    switch (mode) {
      case StockTrackingMode.DISCRETE_UNITS:
        return 0;
      case StockTrackingMode.FRACTIONAL_PHYSICAL:
        if (measureUnit === MeasureUnit.G) {
          return 0;
        }
        return 3;
      case StockTrackingMode.PREPAID_VALUE_POOL:
        return 2;
      default:
        return 0;
    }
  }

  static effectivePrecision(product?: Product | null): number {
    if (!product) {
      return 0;
    }
    if (product.quantityPrecision != null && product.quantityPrecision >= 0) {
      return product.quantityPrecision;
    }
    return this.defaultPrecision(this.effectiveMode(product), product.measureUnit);
  }

  static storageFactor(product?: Product | null): number {
    const mode = this.effectiveMode(product);
    const unit = product?.measureUnit ?? MeasureUnit.UNIT;
    switch (mode) {
      case StockTrackingMode.DISCRETE_UNITS:
        return 1;
      case StockTrackingMode.FRACTIONAL_PHYSICAL:
        switch (unit) {
          case MeasureUnit.KG:
          case MeasureUnit.LITER:
            return 1000;
          case MeasureUnit.G:
          case MeasureUnit.ML:
            return 1;
          default:
            return 1;
        }
      case StockTrackingMode.PREPAID_VALUE_POOL:
        return 100;
      default:
        return 1;
    }
  }

  static toDisplayQuantity(product: Product | null | undefined, storageQuantity: number | null | undefined): number {
    if (storageQuantity == null) {
      return 0;
    }
    if (!product || !this.isFractional(product)) {
      return storageQuantity;
    }
    const factor = this.storageFactor(product);
    const precision = this.effectivePrecision(product);
    const display = storageQuantity / factor;
    return precision > 0 ? Number(display.toFixed(precision)) : display;
  }

  static toStorageQuantity(product: Product | null | undefined, displayQuantity: number): number {
    if (!product || !this.isFractional(product)) {
      return Math.round(displayQuantity);
    }
    const factor = this.storageFactor(product);
    return Math.max(1, Math.round(displayQuantity * factor));
  }

  static lineAmount(product: Product | null | undefined, storageQuantity: number, unitPricePerDisplayUnit: number): number {
    if (!storageQuantity || !unitPricePerDisplayUnit) {
      return 0;
    }
    if (!product || !this.isFractional(product)) {
      return unitPricePerDisplayUnit * storageQuantity;
    }
    const displayQty = this.toDisplayQuantity(product, storageQuantity);
    return unitPricePerDisplayUnit * displayQty;
  }

  /** Stock quantity shown in UI (prefers API display fields). */
  static displayStock(product?: Product | null): number {
    if (!product) {
      return 0;
    }
    if (product.displayNetAvailableQuantity != null) {
      return product.displayNetAvailableQuantity;
    }
    if (product.netAvailableQuantity != null) {
      return this.toDisplayQuantity(product, product.netAvailableQuantity);
    }
    if (product.displayQuantityAvailable != null) {
      return product.displayQuantityAvailable;
    }
    return this.toDisplayQuantity(product, product.quantityAvailable ?? 0);
  }

  static inputStep(product?: Product | null): number {
    const precision = this.effectivePrecision(product);
    if (precision <= 0) {
      return 1;
    }
    return Math.pow(10, -precision);
  }

  static allowedMeasureUnits(mode: StockTrackingMode): MeasureUnit[] {
    switch (mode) {
      case StockTrackingMode.FRACTIONAL_PHYSICAL:
        return [MeasureUnit.KG, MeasureUnit.G, MeasureUnit.LITER, MeasureUnit.ML];
      case StockTrackingMode.PREPAID_VALUE_POOL:
        return [MeasureUnit.CURRENCY, MeasureUnit.UNIT];
      default:
        return Object.values(MeasureUnit);
    }
  }
}
