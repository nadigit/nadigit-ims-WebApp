import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { ShopService } from 'src/app/services/shop.service';
import { TranslationService } from 'src/app/services/translation.service';
import { TranslateService } from '@ngx-translate/core';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Shop } from 'src/app/models/shop';
import { CashRegister } from 'src/app/models/cashRegister';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom } from 'rxjs';
import { LocationService } from 'src/app/services/location.service';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { BankAccount } from 'src/app/models/bank-account';
import { ShopFormDialogConfig, ShopFormDialogData } from './shop-form-dialog/shop-form-dialog.component';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';
import {
  buildCashRegisterSchedulePayload,
  parseCashRegisterSchedule,
} from 'src/app/utils/cash-register-schedule.util';

@Component({
  templateUrl: './shops.component.html',
  styleUrls: ['./shops.component.css', '../inventory.component.css'],
  providers: [MessageService],
})
export class ShopsComponent implements OnInit {
  @ViewChild('dt') dt!: Table;

  Ressource = 'SHOPS';

  shopDialogConfig: ShopFormDialogConfig = {
    visible: false,
    mode: 'edit',
    shop: {},
  };

  deleteShopDialog = false;
  deleteShopsDialog = false;
  shops: Shop[] = [];
  shop: Shop = {};
  selectedShops: Shop[] = [];
  submitted = false;
  cols: any[] = [];
  rowsPerPageOptions = [20, 50, 100];
  pageSize = 20;
  countries: any;
  exportColumns!: ExportColumn[];

  canAddShop = false;
  canEditShop = false;
  canReadShop = false;
  canDeleteShop = false;
  canReadCash = false;
  isLoading = false;
  isExporting = false;
  exportProgress = '';
  currency = '';
  maxShopsCap: number | null = null;
  bankAccounts: BankAccount[] = [];

  private pendingCashRegisterSchedule: { openingTime: string; closingTime: string } | null = null;

  constructor(
    private messageService: MessageService,
    private shopService: ShopService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private locationService: LocationService,
    private permissionService: PermissionService,
    private configService: AppConfigurationService,
    public keycloakService: KeycloakService,
    private router: Router,
    private bankAccountService: BankAccountService,
    private organizationService: OrganizationService,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
    public pageSizeService: TablePageSizeService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    this.pageSize = this.pageSizeService.initState(TablePageSizeKeys.shops, this.rowsPerPageOptions, {
      pageSize: this.pageSize,
    });
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.countries = this.locationService.getAllCountriesWithTranslation();
    });
    await this.checkPermissions();
    await this.licenseCapabilitiesService.ensureLoaded();
    this.refreshPlanLimits();
    this.onGetAllShops();

    this.cols = [
      { field: 'shopId', header: this.translateService.instant('ID') },
      { field: 'shopName', header: this.translateService.instant('shop_name') },
      { field: 'description', header: this.translateService.instant('shop_description') },
      { field: 'city', header: this.translateService.instant('shop_city') },
      { field: 'country', header: this.translateService.instant('shop_country') },
      { field: 'address', header: this.translateService.instant('shop_address') },
    ];
    this.exportColumns = this.cols.map(col => ({ title: col.header, dataKey: col.field }));
  }

  onTablePage(event: any): void {
    this.pageSizeService.applyPageEvent(TablePageSizeKeys.shops, this.rowsPerPageOptions, event, this);
  }

  get isAtShopsCapacity(): boolean {
    return this.maxShopsCap != null && (this.shops?.length || 0) >= this.maxShopsCap;
  }

  private refreshPlanLimits(): void {
    const snap = this.licenseCapabilitiesService.getSnapshot();
    const maxShops = snap?.tierLimits?.maxShops;
    this.maxShopsCap = maxShops == null || maxShops < 0 ? null : maxShops;
  }

  async checkPermissions(): Promise<void> {
    const profile = await this.keycloakService.loadUserProfile();
    await this.permissionService.init(profile.id!).toPromise();
    this.canAddShop = this.permissionService.canCreate(this.Ressource);
    this.canEditShop = this.permissionService.canUpdate(this.Ressource);
    this.canReadShop = this.permissionService.canRead(this.Ressource);
    this.canDeleteShop = this.permissionService.canDelete(this.Ressource);
    this.canReadCash = this.permissionService.canCashRead(this.Ressource);
  }

  deleteSelectedShops(): void {
    this.deleteShopsDialog = true;
  }

  async editShop(shop: Shop): Promise<void> {
    await this.loadBankAccounts();
    let cashRegisterOpeningTime: Date | null = null;
    let cashRegisterClosingTime: Date | null = null;
    if (shop.shopId) {
      try {
        const register = await firstValueFrom(this.shopService.getCashRegister(shop.shopId)) as CashRegister;
        const schedule = parseCashRegisterSchedule(register?.openingTime, register?.closingTime);
        cashRegisterOpeningTime = schedule.openingTime ?? null;
        cashRegisterClosingTime = schedule.closingTime ?? null;
      } catch {
        /* register may not exist yet */
      }
    }
    this.shopDialogConfig = {
      visible: true,
      mode: 'edit',
      shop: { ...shop },
      cashRegisterOpeningTime,
      cashRegisterClosingTime,
    };
  }

  openShopDetails(shop: Shop): void {
    if (shop?.shopId) {
      void this.router.navigate(['/inventory/shops', shop.shopId]);
    }
  }

  deleteShop(shop: Shop): void {
    this.deleteShopDialog = true;
    this.shop = { ...shop };
  }

  async confirmDeleteSelected(): Promise<void> {
    this.deleteShopsDialog = false;
    await Promise.all(this.selectedShops.map(selectedShop => this.onDeleteShop(selectedShop.shopId)));
    this.selectedShops = [];
  }

  async confirmDelete(): Promise<void> {
    this.deleteShopDialog = false;
    await this.onDeleteShop(this.shop.shopId);
    this.shop = {};
  }

  hideDialog(): void {
    this.shopDialogConfig.visible = false;
    this.submitted = false;
    this.pendingCashRegisterSchedule = null;
  }

  onShopDialogConfigChange(config: ShopFormDialogConfig): void {
    this.shopDialogConfig = config;
  }

  onShopSave(dialogData: ShopFormDialogData): void {
    this.shop = dialogData.shop;
    this.pendingCashRegisterSchedule = buildCashRegisterSchedulePayload(
      dialogData.cashRegisterOpeningTime,
      dialogData.cashRegisterClosingTime,
    );
    void this.saveShop();
  }

  onShopCancel(): void {
    this.hideDialog();
  }

  async loadBankAccounts(): Promise<void> {
    // BANK_ACCOUNTS is PRO+; /api/bank-accounts is refused below it. Checked inside the
    // loader so it cannot race whatever fires it.
    await this.licenseCapabilitiesService.ensureLoaded();
    if (!this.licenseCapabilitiesService.isFeatureEnabled('BANK_ACCOUNTS')) {
      this.bankAccounts = [];
      return;
    }
    try {
      const accounts$ = await this.bankAccountService.getBankAccounts(true);
      this.bankAccounts = await firstValueFrom(accounts$) as BankAccount[];
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  }

  async openNew(): Promise<void> {
    if (this.isAtShopsCapacity) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('license_update_toast_title'),
        detail: `Shop limit reached for current plan (${this.maxShopsCap}).`,
        life: 4000,
      });
      return;
    }
    await this.loadBankAccounts();
    this.shopDialogConfig = {
      visible: true,
      mode: 'create',
      shop: {},
    };
    this.shop = {};
    this.submitted = false;
    this.pendingCashRegisterSchedule = null;
  }

  async saveShop(): Promise<void> {
    this.submitted = true;
    let bankId: number | undefined = this.shop.defaultBankAccountId as number | undefined;
    if (bankId == null && this.shop.defaultBankAccount && typeof this.shop.defaultBankAccount === 'object') {
      bankId = (this.shop.defaultBankAccount as BankAccount).accountId;
    }
    if (bankId != null && String(bankId).trim() !== '') {
      const n = Number(bankId);
      this.shop.defaultBankAccountId = Number.isFinite(n) ? n : undefined;
      this.shop.defaultBankAccount = this.shop.defaultBankAccountId
        ? ({ accountId: this.shop.defaultBankAccountId } as BankAccount)
        : undefined;
    } else {
      this.shop.defaultBankAccountId = undefined;
      this.shop.defaultBankAccount = undefined;
    }

    if (!this.shop.shopName) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000,
      });
      return;
    }

    try {
      if (this.shop.shopId) {
        await firstValueFrom(this.shopService.updateShop(this.shop.shopId, this.shop));
        await this.persistCashRegisterSchedule(this.shop.shopId);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('shop_updated'),
          life: 3000,
        });
      } else {
        const created = await firstValueFrom(await this.shopService.saveShop(this.shop)) as Shop;
        if (created?.shopId && this.pendingCashRegisterSchedule) {
          await this.persistCashRegisterSchedule(created.shopId);
        }
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('shop_added'),
          life: 3000,
        });
      }
      this.shops = [...this.shops];
      this.shopDialogConfig.visible = false;
      this.shop = {};
      this.pendingCashRegisterSchedule = null;
      this.onGetAllShops();
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant(this.shop.shopId ? 'error_updating_shop' : 'error_adding_shop'),
        life: 3000,
      });
    }
  }

  private async persistCashRegisterSchedule(shopId: number): Promise<void> {
    if (!this.pendingCashRegisterSchedule) {
      return;
    }
    try {
      await firstValueFrom(this.shopService.updateCashRegister(shopId, this.pendingCashRegisterSchedule));
    } catch (error) {
      console.error('Error saving cash register schedule:', error);
    }
  }

  onGlobalFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dt?.filterGlobal(value, 'contains');
  }

  async onGetAllShops(): Promise<void> {
    await (await this.shopService.getShops()).subscribe({
      next: (response: any) => {
        this.shops = response;
        this.refreshPlanLimits();
        this.shops.forEach((shop: any) => (shop.creationDate = new Date(shop.creationDate)));
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_shops'),
          life: 3000,
        });
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  async onDeleteShop(id: any): Promise<void> {
    await (await this.shopService.deleteShop(id)).subscribe({
      next: () => {
        this.onGetAllShops();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('shop_deleted'),
          life: 3000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_deleting_shop'),
          life: 3000,
        });
      },
    });
  }

  openCashRegisterDialog(shop: Shop): void {
    if (!shop?.shopId) {
      return;
    }
    void this.router.navigate(['/finance/treasury/cash-registers', shop.shopId]);
  }

  async exportPdf(): Promise<void> {
    if (this.isExporting) {
      return;
    }
    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      const filteredShops = this.dt?.filteredValue || this.shops || [];
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      const translationKeyMap: Record<string, string> = {
        shopId: 'ID',
        shopName: 'shop_name',
        description: 'shop_description',
        city: 'shop_city',
        country: 'shop_country',
        address: 'shop_address',
      };
      const translatedExportColumns: ExportColumn[] = this.cols
        .filter(col => col.field !== 'shopId')
        .map(col => ({
          title: this.translate.instant(translationKeyMap[col.field] || col.field),
          dataKey: col.field,
        }));
      this.reportingService.exportPdf(translatedExportColumns, filteredShops, 'shops', this.translate.instant('shops_menu_title'));
      this.translate.use(currentLang);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully'),
        life: 3000,
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      this.isExporting = false;
      this.exportProgress = '';
    }
  }

  async exportExcel(): Promise<void> {
    if (this.isExporting) {
      return;
    }
    try {
      this.isExporting = true;
      const filteredShops = this.dt?.filteredValue || this.shops || [];
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      const translationKeyMap: Record<string, string> = {
        shopId: 'ID',
        shopName: 'shop_name',
        description: 'shop_description',
        city: 'shop_city',
        country: 'shop_country',
        address: 'shop_address',
      };
      const translatedShops = filteredShops.map(shop => {
        const translated: Record<string, unknown> = {};
        this.cols.forEach(col => {
          if (col.field !== 'creationDate' && col.field !== 'shopId') {
            translated[this.translate.instant(translationKeyMap[col.field] || col.field)] = shop[col.field as keyof Shop];
          }
        });
        return translated;
      });
      this.reportingService.exportExcel(translatedShops, 'shops');
      this.translate.use(currentLang);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully'),
        life: 3000,
      });
    } catch (error) {
      console.error('Error exporting Excel:', error);
    } finally {
      this.isExporting = false;
      this.exportProgress = '';
    }
  }
}
