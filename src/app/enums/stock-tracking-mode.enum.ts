export enum StockTrackingMode {
  DISCRETE_UNITS = 'DISCRETE_UNITS',
  FRACTIONAL_PHYSICAL = 'FRACTIONAL_PHYSICAL',
  PREPAID_VALUE_POOL = 'PREPAID_VALUE_POOL',
}

export function stockTrackingModeFrom(value?: string | null): StockTrackingMode {
  if (!value) {
    return StockTrackingMode.DISCRETE_UNITS;
  }
  const upper = value.toUpperCase();
  if (upper in StockTrackingMode) {
    return StockTrackingMode[upper as keyof typeof StockTrackingMode];
  }
  return StockTrackingMode.DISCRETE_UNITS;
}
