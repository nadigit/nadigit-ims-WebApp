import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// PrimeNG imports
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// Models and Services
import { Customer } from 'src/app/models/customer';
import { PriceListDTO } from 'src/app/models/pricing';
import { Country, State } from 'country-state-city';
import { LocationService } from 'src/app/services/location.service';
import { PricingService } from 'src/app/services/pricing.service';
import { MessageService } from 'primeng/api';

export interface CustomerFormDialogData {
  customer: Customer;
  selectedPriceListId: number | null;
}

export interface CustomerFormDialogConfig {
  visible: boolean;
  mode: 'create' | 'edit';
  customer: Customer;
  selectedPriceListId: number | null;
  isLoadingPriceLists: boolean;
}

@Component({
  selector: 'app-customer-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    RadioButtonModule,
    InputTextModule,
    DropdownModule,
    InputTextareaModule,
    TranslateModule
  ],
  templateUrl: './customer-form-dialog.component.html',
  styleUrl: './customer-form-dialog.component.scss'
})
export class CustomerFormDialogComponent implements OnInit, OnChanges {

  @Input() config!: CustomerFormDialogConfig;
  @Input() countries: any[] = [];
  @Input() priceLists: PriceListDTO[] = [];
  @Input() submitted: boolean = false;

  @Output() configChange = new EventEmitter<CustomerFormDialogConfig>();
  @Output() save = new EventEmitter<CustomerFormDialogData>();
  @Output() cancel = new EventEmitter<void>();

  selectedCountry: any = null;
  states: any = null;

  constructor(
    private locationService: LocationService,
    private messageService: MessageService,
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
      if (config.customer?.country) {
        this.onSelectedCountry(config.customer.country);
      }
    }
  }

  onSelectedCountry(event: any) {
    if (this.config.customer.country !== this.selectedCountry && !this.config.customer.city) {
      this.config.customer.city = undefined;
    }

    this.countries.forEach((element: any) => {
      if (element.name === event) {
        this.selectedCountry = element;
        this.states = this.locationService.getStatesByCountryCode(element.isoCode);
      }
    });
  }

  getPriceListLabel(list: PriceListDTO | null | undefined): string {
    if (!list?.name) return '';
    const key = `price_list_${list.name.toLowerCase()}`;
    const translated = this.translate.instant(key);
    return translated && translated !== key ? translated : list.name;
  }

  getPriceListLabelById(priceListId: number | null | undefined): string {
    if (!priceListId) return '';
    const list = this.priceLists.find(item => item.id === priceListId);
    return list ? this.getPriceListLabel(list) : '';
  }

  onSave() {
    const dialogData: CustomerFormDialogData = {
      customer: this.config.customer,
      selectedPriceListId: this.config.selectedPriceListId
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
