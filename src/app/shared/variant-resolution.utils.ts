import { ProductVariantLine } from '../models/product-family';

/** Match a variant SKU line by selected axis values (case-insensitive). */
export function findVariantByOptions(
  variants: ProductVariantLine[],
  axes: string[],
  selected: Record<string, string>,
): ProductVariantLine | null {
  if (!variants?.length || !axes?.length) {
    return null;
  }
  for (const axis of axes) {
    if (!selected[axis]?.trim()) {
      return null;
    }
  }
  return (
    variants.find((line) => {
      const opts = line.variantOptions ?? {};
      for (const axis of axes) {
        const want = selected[axis]?.trim().toLowerCase();
        const got = String(opts[axis] ?? '').trim().toLowerCase();
        if (!want || want !== got) {
          return false;
        }
      }
      return true;
    }) ?? null
  );
}

/** Distinct values for one axis from loaded variant lines. */
export function distinctAxisValues(variants: ProductVariantLine[], axis: string): string[] {
  const values = new Set<string>();
  for (const line of variants ?? []) {
    const v = line.variantOptions?.[axis];
    if (v != null && String(v).trim() !== '') {
      values.add(String(v).trim());
    }
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
