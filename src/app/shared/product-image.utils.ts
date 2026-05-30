const DEFAULT_PRODUCT_IMAGE = 'assets/core-images/no-image.png';

function toTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolvePublicAssetUrl(rawUrl: unknown): string {
  const s = toTrimmed(rawUrl);
  if (!s) return '';
  if (/^(blob:|data:|assets\/|https?:\/\/)/i.test(s)) return s;
  if (s.startsWith('//')) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
    return `${protocol}${s}`;
  }
  if (s.startsWith('/')) {
    const env = (typeof window !== 'undefined'
      ? (window as unknown as { __env?: Record<string, string> }).__env
      : undefined) || {};
    const apiProtocol = env['apiProtocol'] || 'http';
    const apiHost = env['apiHost'] || 'localhost';
    const apiPort = env['apiPort'] || '8090';
    return `${apiProtocol}://${apiHost}:${apiPort}${s}`;
  }
  return s;
}

export function getPreferredProductImageUrl(productLike: any, fallback: string = DEFAULT_PRODUCT_IMAGE): string {
  if (!productLike) return fallback;

  const galleryPrimary = Array.isArray(productLike?.productImages)
    ? productLike.productImages.find((img: any) => !!img?.primaryImage)?.imageUrl
    : '';
  const galleryFirst = Array.isArray(productLike?.productImages)
    ? productLike.productImages.find((img: any) => !!toTrimmed(img?.imageUrl))?.imageUrl
    : '';

  const candidates = [
    productLike.primaryImageUrl,
    productLike.primaryImage,
    galleryPrimary,
    productLike.productImage,
    productLike.imageUrl,
    galleryFirst,
  ];

  for (const c of candidates) {
    const resolved = resolvePublicAssetUrl(c);
    if (resolved) return resolved;
  }
  return fallback;
}
