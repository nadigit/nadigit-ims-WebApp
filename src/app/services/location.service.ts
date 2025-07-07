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
      translatedName: this.translate.instant(`countries.${country.name}`)
    }));
  }

  getStatesByCountryCode(countryCode: string): any[] {
    return State.getStatesOfCountry(countryCode);
  }
}
