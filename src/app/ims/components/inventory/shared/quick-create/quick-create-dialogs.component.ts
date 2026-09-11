import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { Supplier } from 'src/app/models/supplier';
import { Warehouse } from 'src/app/models/warehouse';
import { Shop } from 'src/app/models/shop';
import { BankAccount } from 'src/app/models/bank-account';
import { SupplierService } from 'src/app/services/supplier.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { ShopService } from 'src/app/services/shop.service';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { LocationService } from 'src/app/services/location.service';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import { buildCashRegisterSchedulePayload } from 'src/app/utils/cash-register-schedule.util';
import {
  SupplierFormDialogConfig,
  SupplierFormDialogData,
} from '../../../purchases/suppliers/supplier-form-dialog/supplier-form-dialog.component';
import {
  WarehouseFormDialogConfig,
  WarehouseFormDialogData,
} from '../../warehouses/warehouse-form-dialog/warehouse-form-dialog.component';
import { ShopFormDialogConfig, ShopFormDialogData } from '../../shops/shop-form-dialog/shop-form-dialog.component';
import { httpErrorMessage } from 'src/app/shared/http-error-message';

type CappedResource = 'warehouse' | 'shop';

/**
 * "Create it now" for the records a form picks from: a supplier, a warehouse, a shop.
 *
 * Every form that offers the + beside one of those pickers hosts this component and calls
 * openSupplier / openWarehouse / openShop; it gets the created record back through an output and
 * selects it. Before this, each form carried its own copy of the dialogs and the save code — or a
 * toast saying "quick add is not available in this form yet" — and the copies that did save showed
 * "added" before the request had finished and never selected what they created.
 *
 * Plan caps are checked before the form opens (warehouses and shops are counted per plan), so the
 * user is told about the limit instead of filling a form the server will refuse. The server still
 * enforces the cap; this only spares the wasted effort.
 */
@Component({
  selector: 'app-quick-create-dialogs',
  template: `
    <app-supplier-form-dialog
      [config]="supplierConfig"
      [countries]="countries"
      [submitted]="supplierSubmitted"
      (configChange)="supplierConfig = $event"
      (save)="saveSupplier($event)"
      (cancel)="closeSupplier()">
    </app-supplier-form-dialog>

    <app-warehouse-form-dialog
      [config]="warehouseConfig"
      [countries]="countries"
      (configChange)="warehouseConfig = $event"
      (save)="saveWarehouse($event)"
      (cancel)="closeWarehouse()">
    </app-warehouse-form-dialog>

    <app-shop-form-dialog
      [config]="shopConfig"
      [countries]="countries"
      [bankAccounts]="bankAccounts"
      [currency]="currency"
      [submitted]="shopSubmitted"
      (configChange)="shopConfig = $event"
      (save)="saveShop($event)"
      (cancel)="closeShop()">
    </app-shop-form-dialog>
  `,
})
export class QuickCreateDialogsComponent {
  @Input() currency = '';

  @Output() supplierCreated = new EventEmitter<Supplier>();
  @Output() warehouseCreated = new EventEmitter<Warehouse>();
  @Output() shopCreated = new EventEmitter<Shop>();

  supplierConfig: SupplierFormDialogConfig = { visible: false, mode: 'create', supplier: {} };
  warehouseConfig: WarehouseFormDialogConfig = {
    visible: false,
    mode: 'create',
    warehouse: {},
    selectedCountry: {},
    submitted: false,
  };
  shopConfig: ShopFormDialogConfig = { visible: false, mode: 'create', shop: {} };

  supplierSubmitted = false;
  shopSubmitted = false;
  countries: any[] = [];
  bankAccounts: BankAccount[] = [];

  private saving = false;

  constructor(
    private supplierService: SupplierService,
    private warehouseService: WarehouseService,
    private shopService: ShopService,
    private bankAccountService: BankAccountService,
    private locationService: LocationService,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
    private messageService: MessageService,
    private translate: TranslateService,
  ) {}

  // ---------------------------------------------------------------------------------------------
  // Open
  // ---------------------------------------------------------------------------------------------

  openSupplier(): void {
    this.loadCountries();
    this.supplierSubmitted = false;
    this.supplierConfig = { visible: true, mode: 'create', supplier: {} };
  }

  async openWarehouse(): Promise<void> {
    if (!(await this.isWithinPlanCap('warehouse'))) {
      return;
    }
    this.loadCountries();
    this.warehouseConfig = { visible: true, mode: 'create', warehouse: {}, selectedCountry: {}, submitted: false };
  }

  async openShop(): Promise<void> {
    if (!(await this.isWithinPlanCap('shop'))) {
      return;
    }
    this.loadCountries();
    await this.loadBankAccounts();
    this.shopSubmitted = false;
    this.shopConfig = {
      visible: true,
      mode: 'create',
      shop: {},
      cashRegisterOpeningTime: null,
      cashRegisterClosingTime: null,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------------------------

  async saveSupplier(data: SupplierFormDialogData): Promise<void> {
    const supplier: Supplier = data?.supplier ?? {};
    this.supplierSubmitted = true;
    if (!supplier.name?.trim()) {
      this.warnRequiredFields();
      return;
    }
    if (this.saving) {
      return;
    }
    this.saving = true;
    try {
      const created = (await firstValueFrom(await this.supplierService.saveSupplier(supplier))) as Supplier;
      this.closeSupplier();
      this.notifySuccess('supplier_added');
      this.supplierCreated.emit(created?.supplierId ? created : { ...supplier });
    } catch (err) {
      this.notifyError(err, 'error_while_adding_supplier');
    } finally {
      this.saving = false;
    }
  }

  async saveWarehouse(data: WarehouseFormDialogData): Promise<void> {
    const warehouse: Warehouse = data?.warehouse ?? {};
    this.warehouseConfig = { ...this.warehouseConfig, submitted: true };
    if (!warehouse.name?.trim()) {
      this.warnRequiredFields();
      return;
    }
    if (this.saving) {
      return;
    }
    this.saving = true;
    try {
      const created = (await firstValueFrom(await this.warehouseService.saveWarehouse(warehouse))) as Warehouse;
      this.closeWarehouse();
      this.notifySuccess('warehouse_added');
      this.warehouseCreated.emit(created?.warehouseId ? created : { ...warehouse });
    } catch (err) {
      this.notifyError(err, 'error_while_adding_warehouse');
    } finally {
      this.saving = false;
    }
  }

  async saveShop(data: ShopFormDialogData): Promise<void> {
    const shop: Shop = data?.shop ?? {};
    this.shopSubmitted = true;
    if (!shop.shopName?.trim()) {
      this.warnRequiredFields();
      return;
    }
    if (this.saving) {
      return;
    }
    this.normalizeDefaultBankAccount(shop);
    const schedule = buildCashRegisterSchedulePayload(data.cashRegisterOpeningTime, data.cashRegisterClosingTime);

    this.saving = true;
    try {
      const created = (await firstValueFrom(await this.shopService.saveShop(shop))) as Shop;
      if (created?.shopId && schedule) {
        try {
          await firstValueFrom(this.shopService.updateCashRegister(created.shopId, schedule));
        } catch (scheduleError) {
          // The shop exists; a schedule that failed to save can be set from the shop page.
          console.error('Error saving cash register schedule:', scheduleError);
        }
      }
      this.closeShop();
      this.notifySuccess('shop_added');
      this.shopCreated.emit(created?.shopId ? created : { ...shop });
    } catch (err) {
      this.notifyError(err, 'error_while_adding_shop');
    } finally {
      this.saving = false;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Close
  // ---------------------------------------------------------------------------------------------

  closeSupplier(): void {
    this.supplierConfig = { visible: false, mode: 'create', supplier: {} };
    this.supplierSubmitted = false;
  }

  closeWarehouse(): void {
    this.warehouseConfig = { visible: false, mode: 'create', warehouse: {}, selectedCountry: {}, submitted: false };
  }

  closeShop(): void {
    this.shopConfig = { visible: false, mode: 'create', shop: {} };
    this.shopSubmitted = false;
  }

  // ---------------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------------

  /**
   * Warehouses and shops are counted against the plan (Starter and Pro allow one of each).
   * Counts come from the server at the moment of asking, not from whatever list the host holds,
   * which may be filtered or stale. If the count cannot be read, the form opens and the server
   * has the last word.
   */
  private async isWithinPlanCap(resource: CappedResource): Promise<boolean> {
    try {
      await this.licenseCapabilitiesService.ensureLoaded();
    } catch {
      return true;
    }
    const limits = this.licenseCapabilitiesService.getSnapshot()?.tierLimits;
    const cap = resource === 'warehouse' ? limits?.maxWarehouses : limits?.maxShops;
    if (cap == null || cap < 0) {
      return true;
    }

    let count: number;
    try {
      const list =
        resource === 'warehouse'
          ? await firstValueFrom(await this.warehouseService.getWarehouses())
          : await firstValueFrom(await this.shopService.getShops());
      count = Array.isArray(list) ? list.length : 0;
    } catch {
      return true;
    }
    if (count < cap) {
      return true;
    }

    this.messageService.add({
      severity: 'warn',
      summary: this.translate.instant('plan_limit_reached_title'),
      detail: this.translate.instant(
        resource === 'warehouse' ? 'plan_limit_reached_warehouses' : 'plan_limit_reached_shops',
        { count: cap },
      ),
      life: 6000,
    });
    return false;
  }

  private loadCountries(): void {
    this.countries = this.locationService.getAllCountriesWithTranslation();
  }

  /** Bank accounts are PRO+; below that the shop form simply offers none. */
  private async loadBankAccounts(): Promise<void> {
    this.bankAccounts = [];
    try {
      await this.licenseCapabilitiesService.ensureLoaded();
      if (!this.licenseCapabilitiesService.isFeatureEnabled('BANK_ACCOUNTS')) {
        return;
      }
      this.bankAccounts = (await firstValueFrom(await this.bankAccountService.getBankAccounts(true))) as BankAccount[];
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  }

  /** Same normalisation as the shops page: the API wants an id reference, not the picked object. */
  private normalizeDefaultBankAccount(shop: Shop): void {
    let bankId: number | undefined = shop.defaultBankAccountId as number | undefined;
    if (bankId == null && shop.defaultBankAccount && typeof shop.defaultBankAccount === 'object') {
      bankId = (shop.defaultBankAccount as BankAccount).accountId;
    }
    if (bankId != null && String(bankId).trim() !== '') {
      const n = Number(bankId);
      shop.defaultBankAccountId = Number.isFinite(n) ? n : undefined;
      shop.defaultBankAccount = shop.defaultBankAccountId
        ? ({ accountId: shop.defaultBankAccountId } as BankAccount)
        : undefined;
    } else {
      shop.defaultBankAccountId = undefined;
      shop.defaultBankAccount = undefined;
    }
  }

  private warnRequiredFields(): void {
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('error'),
      detail: this.translate.instant('please_fill_required_fields'),
      life: 3000,
    });
  }

  private notifySuccess(detailKey: string): void {
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('successful'),
      detail: this.translate.instant(detailKey),
      life: 3000,
    });
  }

  /** The server localises its messages (plan caps, duplicates); prefer them over a generic line. */
  private notifyError(err: any, fallbackKey: string): void {
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('error'),
      detail: httpErrorMessage(err, this.translate.instant(fallbackKey)),
      life: 5000,
    });
  }
}
