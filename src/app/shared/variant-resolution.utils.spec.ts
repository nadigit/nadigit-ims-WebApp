import { findVariantByOptions, distinctAxisValues } from './variant-resolution.utils';
import { ProductVariantLine } from '../models/product-family';

describe('variant-resolution.utils', () => {
  const variants: ProductVariantLine[] = [
    { productId: 1, reference: 'A-M-R', variantOptions: { Size: 'M', Color: 'Red' } },
    { productId: 2, reference: 'A-L-B', variantOptions: { Size: 'L', Color: 'Blue' } },
  ];

  it('findVariantByOptions matches case-insensitively', () => {
    const found = findVariantByOptions(variants, ['Size', 'Color'], { Size: 'm', Color: 'red' });
    expect(found?.productId).toBe(1);
  });

  it('distinctAxisValues returns sorted unique values', () => {
    expect(distinctAxisValues(variants, 'Size')).toEqual(['L', 'M']);
  });
});
