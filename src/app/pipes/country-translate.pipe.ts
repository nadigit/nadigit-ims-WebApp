import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'countryTranslate',
})
export class CountryTranslatePipe implements PipeTransform {
  constructor(private translate: TranslateService) {}

  transform(countryName: string): string {
    if (!countryName) return '';
    
    // Remove any existing 'countries.' prefix if present
    const cleanName = countryName.replace(/^countries\./, '');
    
    // Try to get translation
    const translation = this.translate.instant(`countries.${cleanName}`);
    
    // If we get the key back (with 'countries.'), try without prefix
    if (translation === `countries.${cleanName}`) {
      return cleanName;
    }
    
    return translation || cleanName;
  }

}


