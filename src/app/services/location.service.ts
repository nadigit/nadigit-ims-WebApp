import { Injectable } from '@angular/core';
import { Country, State } from 'country-state-city';
import { TranslateService } from '@ngx-translate/core';


@Injectable({
  providedIn: 'root'
})
export class LocationService {

  constructor(private translate: TranslateService) {}

  getAllCountriesWithTranslation(): any[] {
    return Country.getAllCountries().map(country => ({
      ...country,
      translatedName: this.translateCountryName(country.name)
    }));
  }

  /**
   * Translate a country name, falling back to the raw name when no
   * `countries.<name>` key exists so dropdowns never display the translation
   * key itself (e.g. "countries.United States").
   */
  private translateCountryName(name: string): string {
    if (!name) return '';
    const key = `countries.${name}`;
    const translated = this.translate.instant(key);
    return translated === key ? name : translated;
  }

  getStatesByCountryCode(countryCode: string): any[] {
    return State.getStatesOfCountry(countryCode);
  }
}
