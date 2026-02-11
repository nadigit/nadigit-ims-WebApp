import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { Warehouse } from 'src/app/models/warehouse';
import { Country, State } from 'country-state-city';
import { LocationService } from 'src/app/services/location.service';
import { TranslateService } from '@ngx-translate/core';

export interface WarehouseFormDialogData {
  warehouse: Warehouse;
  selectedCountry: any;
}

export interface WarehouseFormDialogConfig {
  visible: boolean;
  mode: 'create' | 'edit';
  warehouse: Warehouse;
  selectedCountry: any;
  submitted: boolean;
}

@Component({
  selector: 'app-warehouse-form-dialog',
  templateUrl: './warehouse-form-dialog.component.html',
  styleUrls: ['./warehouse-form-dialog.component.css']
})
export class WarehouseFormDialogComponent implements OnInit, OnChanges {

  @Input() config!: WarehouseFormDialogConfig;
  @Input() countries: any[] = [];

  @Output() configChange = new EventEmitter<WarehouseFormDialogConfig>();
  @Output() save = new EventEmitter<WarehouseFormDialogData>();
  @Output() cancel = new EventEmitter<void>();

  selectedCountry: any = null;
  states: any = null;

  constructor(
    private locationService: LocationService,
    private translate: TranslateService
  ) { }

  ngOnInit() {
    if (!this.countries || this.countries.length === 0) {
      this.countries = this.locationService.getAllCountriesWithTranslation();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && changes['config'].currentValue) {
      const config = changes['config'].currentValue;
      if (config.warehouse?.country) {
        this.onSelectedCountry(config.warehouse.country);
      }
    }
  }

  onSave() {
    const dialogData: WarehouseFormDialogData = {
      warehouse: this.config.warehouse,
      selectedCountry: this.selectedCountry
    };

    this.save.emit(dialogData);
  }

  onCancel() {
    this.cancel.emit();
  }

  onSelectedCountry(event: any) {
    if (!event) {
      this.selectedCountry = null;
      this.states = null;
      this.config.warehouse.city = undefined;
      this.configChange.emit(this.config);
      return;
    }

    // Clear city if country changed
    if (this.config.warehouse.country !== event && !this.config.warehouse.city) {
      this.config.warehouse.city = undefined;
    }

    // Find and set the selected country object
    this.countries.forEach((element: any) => {
      if (element.name === event) {
        this.selectedCountry = element;
        this.states = this.locationService.getStatesByCountryCode(element.isoCode);
      }
    });

    // Update config
    this.configChange.emit(this.config);
  }

  getSelectedCountryName(): string {
    if (!this.config.warehouse?.country) {
      return '';
    }

    // Find the country object to get translated name
    const country = this.countries.find((c: any) => c.name === this.config.warehouse.country);
    if (country && country.translatedName) {
      return country.translatedName;
    }

    // Fallback to pipe translation
    return this.config.warehouse.country;
  }

  onChangeCountry() {
    this.config.warehouse.city = undefined;
    // Update config
    this.configChange.emit(this.config);
  }

  filterCountry(value: any, filter: string): boolean {
    // Convert both to lowercase for case-insensitive comparison
    const normalizedFilter = filter.toLowerCase();

    // Check both original name and translated name
    return (
      value.name.toLowerCase().includes(normalizedFilter) ||
      value.translatedName.toLowerCase().includes(normalizedFilter)
    );
  }
}