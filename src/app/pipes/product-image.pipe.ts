import { Pipe, PipeTransform } from '@angular/core';
import { getPreferredProductImageUrl } from 'src/app/shared/product-image.utils';

@Pipe({
  name: 'productImage',
  pure: true,
})
export class ProductImagePipe implements PipeTransform {
  transform(productLike: any): string {
    return getPreferredProductImageUrl(productLike);
  }
}
