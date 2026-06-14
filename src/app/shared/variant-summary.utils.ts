/**
 * Display variant label on product lines (orders, purchases, POS, catalog).
 * Prefers API {@code variantSummary}; falls back to Size/Color attributes.
 */
export function getProductVariantSummary(product: any): string {
  const fromApi = String(product?.variantSummary ?? '').trim();
  if (fromApi) {
    return fromApi;
  }

  const size = readProductAttributeText(product, ['size', 'taille', 'talla', 'taglia', 'groesse', 'größe', 'misura']);
  const color = readProductAttributeText(product, ['color', 'colour', 'couleur', 'farbe', 'colore']);
  if (!size && !color) {
    const opts = product?.variantOptions;
    if (opts && typeof opts === 'object') {
      const parts = Object.entries(opts)
        .filter(([, v]) => v != null && String(v).trim() !== '')
        .map(([k, v]) => `${k}: ${v}`);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
    return '';
  }
  if (size && color) {
    return `${size} / ${color}`;
  }
  return size || color;
}

export function isFashionVariantMissing(product: any, isFashionProfile: boolean): boolean {
  if (!isFashionProfile) {
    return false;
  }
  if (product?.productType === 'SERVICE') {
    return false;
  }
  return !getProductVariantSummary(product);
}

function readProductAttributeText(product: any, names: string[]): string {
  const attrs = product?.attributes;
  if (!Array.isArray(attrs) || attrs.length === 0) {
    return '';
  }
  const wanted = new Set(names.map((n) => n.trim().toLowerCase()));
  const found = attrs.find((a: any) => wanted.has(String(a?.attributeName ?? '').trim().toLowerCase()));
  if (!found) {
    return '';
  }
  const raw = found.value ?? found.stringValue ?? found.intValue ?? found.doubleValue ?? '';
  return String(raw).trim();
}
