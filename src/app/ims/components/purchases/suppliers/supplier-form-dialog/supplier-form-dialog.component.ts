import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';

// Models and Services
import { Supplier } from 'src/app/models/supplier';
import { TranslateService } from '@ngx-translate/core';
import { LocationService } from 'src/app/services/location.service';

export interface SupplierFormDialogData {
  supplier: Supplier;
}

export interface SupplierFormDialogConfig {
  visible: boolean;
  mode: 'create' | 'edit';
  supplier: Supplier;
}

@Component({
  selector: 'app-supplier-form-dialog',
  templateUrl: './supplier-form-dialog.component.html',
  styleUrl: './supplier-form-dialog.component.scss'
})
export class SupplierFormDialogComponent implements OnInit, OnChanges {

  @Input() config!: SupplierFormDialogConfig;
  @Input() countries: any[] = [];
  @Input() submitted: boolean = false;

  @Output() configChange = new EventEmitter<SupplierFormDialogConfig>();
  @Output() save = new EventEmitter<SupplierFormDialogData>();
  @Output() cancel = new EventEmitter<void>();

  selectedCountry: any = null;
  states: any = null;

  constructor(
    private locationService: LocationService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    if (!this.countries || this.countries.length === 0) {
      this.countries = this.locationService.getAllCountriesWithTranslation();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && changes['config'].currentValue) {
      const config = changes['config'].currentValue;
      if (config.supplier?.country) {
        this.onSelectedCountry(config.supplier.country);
      }
    }
  }

  onSelectedCountry(country: string) {
    if (this.config.supplier.country !== this.selectedCountry && !this.config.supplier.city) {
      this.config.supplier.city = undefined;
    }

    this.countries.forEach((element: any) => {
      if (element.name === country) {
        this.selectedCountry = element;
        this.states = this.locationService.getStatesByCountryCode(element.isoCode);
      }
    });
  }

  onSave() {
    const dialogData: SupplierFormDialogData = {
      supplier: this.config.supplier
    };

    this.save.emit(dialogData);
  }

  onCancel() {
    this.cancel.emit();
  }

  hideDialog() {
    const updatedConfig = { ...this.config, visible: false };
    this.configChange.emit(updatedConfig);
    this.selectedCountry = {};
  }
}