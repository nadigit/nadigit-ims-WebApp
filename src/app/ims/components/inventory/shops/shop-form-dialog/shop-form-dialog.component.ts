import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';

// Models and Services
import { Shop } from 'src/app/models/shop';
import { BankAccount } from 'src/app/models/bank-account';
import { TranslateService } from '@ngx-translate/core';
import { LocationService } from 'src/app/services/location.service';

export interface ShopFormDialogData {
  shop: Shop;
  cashRegisterOpeningTime?: Date | null;
  cashRegisterClosingTime?: Date | null;
}

export interface ShopFormDialogConfig {
  visible: boolean;
  mode: 'create' | 'edit';
  shop: Shop;
  cashRegisterOpeningTime?: Date | null;
  cashRegisterClosingTime?: Date | null;
}

@Component({
  selector: 'app-shop-form-dialog',
  templateUrl: './shop-form-dialog.component.html',
  styleUrl: './shop-form-dialog.component.scss'
})
export class ShopFormDialogComponent implements OnInit, OnChanges {

  @Input() config!: ShopFormDialogConfig;
  @Input() countries: any[] = [];
  @Input() bankAccounts: BankAccount[] = [];
  @Input() currency: string = 'USD';
  @Input() submitted: boolean = false;

  @Output() configChange = new EventEmitter<ShopFormDialogConfig>();
  @Output() save = new EventEmitter<ShopFormDialogData>();
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
      if (config.shop?.country) {
        this.onSelectedCountry(config.shop.country);
      }
    }
    if (changes['config'] || changes['bankAccounts']) {
      this.normalizeDefaultBankAccountId();
    }
  }

  /**
   * p-dropdown uses optionValue="accountId" — model must be the id (number), not the full object.
   * API may return nested defaultBankAccount or string ids; coerce so the selection shows when reopening.
   */
  private normalizeDefaultBankAccountId(): void {
    if (!this.config?.shop) return;
    const s = this.config.shop;
    let id: number | undefined;

    const rawId = s.defaultBankAccountId as unknown;
    if (rawId != null && String(rawId).trim() !== '') {
      const n = Number(rawId);
      if (Number.isFinite(n)) {
        id = n;
      }
    }
    if (id == null && s.defaultBankAccount && typeof s.defaultBankAccount === 'object') {
      const aid = (s.defaultBankAccount as BankAccount).accountId;
      if (aid != null) {
        const n = Number(aid);
        if (Number.isFinite(n)) {
          id = n;
        }
      }
    }
    s.defaultBankAccountId = id;
  }

  onSelectedCountry(country: string) {
    if (this.config.shop.country !== this.selectedCountry && !this.config.shop.city) {
      this.config.shop.city = undefined;
    }

    this.countries.forEach((element: any) => {
      if (element.name === country) {
        this.selectedCountry = element;
        this.states = this.locationService.getStatesByCountryCode(element.isoCode);
      }
    });
  }

  onSave() {
    const dialogData: ShopFormDialogData = {
      shop: this.config.shop,
      cashRegisterOpeningTime: this.config.cashRegisterOpeningTime,
      cashRegisterClosingTime: this.config.cashRegisterClosingTime,
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