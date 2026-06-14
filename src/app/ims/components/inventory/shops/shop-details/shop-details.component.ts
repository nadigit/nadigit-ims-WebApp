import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Shop } from 'src/app/models/shop';
import { CashRegister } from 'src/app/models/cashRegister';
import { ShopService } from 'src/app/services/shop.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Purchase } from 'src/app/models/purchase';
import { Expense } from 'src/app/models/expense';
import { LocationService } from 'src/app/services/location.service';
import { DatePipe, Location } from '@angular/common';
import { ShopFormDialogConfig, ShopFormDialogData } from '../shop-form-dialog/shop-form-dialog.component';
import { PosService } from 'src/app/services/pos.service';
import { POSSessionDTO } from 'src/app/models/pos';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { BankAccount } from 'src/app/models/bank-account';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';
import {
  buildCashRegisterSchedulePayload,
  parseCashRegisterSchedule,
} from 'src/app/utils/cash-register-schedule.util';

@Component({
  templateUrl: './shop-details.component.html',
  styleUrls: ['./shop-details.component.css', '../../inventory.component.css'],
  providers: [MessageService, DatePipe]
})
export class ShopDetailsComponent implements OnInit {
  TablePageSizeKeys = TablePageSizeKeys;

  shopId!: number;
  shop: Shop | null = null;

  isLoading: boolean = true;
  loadingShopDetails: boolean = false;
  loadingPurchases: boolean = false;
  loadingExpenses: boolean = false;
  currency: string = 'USD';

  cashRegisterData: any;
  organizationData: any;
  purchaseStats: any;
  expenseStats: any;
  recentPurchases: Purchase[] = [];
  recentExpenses: Expense[] = [];
  shopStats: any = {};

  canEditShop: boolean = false;
  canReadCash: boolean = false;
  Ressource: string = 'SHOPS';
  isAdmin: boolean = false;
  userRoles: any;

  // Dialog configuration for reusable component
  shopDialogConfig: ShopFormDialogConfig = {
    visible: false,
    mode: 'edit',
    shop: {},
  };

  submitted = false;
  countries: any;

  /** ADMIN: POS session history (distinct from cash register sessions). */
  posSessions: POSSessionDTO[] = [];
  posSessionsTotal = 0;
  posSessionsLoading = false;
  posSessionsPage = 0;
  posSessionsPageSize = 10;

  bankAccounts: BankAccount[] = [];
  private pendingCashRegisterSchedule: { openingTime: string; closingTime: string } | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private messageService: MessageService,
    private shopService: ShopService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private locationService: LocationService,
    private datePipe: DatePipe,
    private posService: PosService,
    private bankAccountService: BankAccountService,
    public pageSizeService: TablePageSizeService,
  ) { }

  ngOnInit() {
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.countries = this.locationService.getAllCountriesWithTranslation();
    });
    this.posSessionsPageSize = this.pageSizeService.get(TablePageSizeKeys.shopDetailsSessions, [10, 25, 50], this.posSessionsPageSize);

    this.route.params.subscribe(async params => {
      this.isLoading = true;
      try {
        const id = params['id'];
        if (!id || isNaN(+id)) {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('invalid_shop_id'),
            life: 3000
          });
          this.router.navigate(['/inventory/shops']);
          return;
        }

        this.shopId = +id;
        await this.checkPermissions();
        await this.loadShop();
        if (this.shop) {
          await this.loadShopDetails();
          this.calculateShopStats();
        }
      } catch (error) {
        console.error('Error initializing shop details:', error);
        if (!(error instanceof Error && error.message === 'Shop not found')) {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_shop_details'),
            life: 3000
          });
        }
        if (this.shopId && !isNaN(this.shopId)) {
          this.router.navigate(['/inventory/shops']);
        }
      } finally {
        this.isLoading = false;
      }
    });
  }

  async checkPermissions() {
    try {
      const profile = await this.keycloakService.loadUserProfile();
      const userId = profile.id;
      await firstValueFrom(this.permissionService.init(userId));
      this.canEditShop = this.permissionService.canUpdate(this.Ressource);
      this.canReadCash = this.permissionService.canCashRead(this.Ressource);
      
      // Get user roles
      this.userRoles = await this.keycloakService.getUserRoles();
      this.isAdmin = this.userRoles.includes('ADMIN');
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }

  async loadShop() {
    try {
      await this.shopService.loadToken();
      this.shop = await firstValueFrom(this.shopService.getShop(this.shopId)) as Shop;
      if (this.shop?.creationDate) {
        this.shop.creationDate = new Date(this.shop.creationDate);
      }
    } catch (error: any) {
      console.error('Error loading shop:', error);
      this.shop = null;
      const isNotFound = error?.status === 404;
      if (isNotFound) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('shop_not_found'),
          life: 3000
        });
        throw new Error('Shop not found');
      }
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_shop_details'),
        life: 3000
      });
      throw error;
    }
  }

  async loadShopDetails(): Promise<void> {
    if (!this.shop?.shopId) return;
    
    this.loadingShopDetails = true;
    try {
      await Promise.all([
        this.loadCashRegisterData(),
        this.loadOrganizationData(),
        this.loadPurchaseStats(),
        this.loadExpenseStats(),
        this.loadRecentPurchases(),
        this.loadRecentExpenses()
      ]);
      if (this.isAdmin && this.shop?.shopId) {
        await this.loadPosSessions();
      }
    } catch (error) {
      console.error('Error loading shop details:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_shop_details'),
        life: 3000
      });
    } finally {
      this.loadingShopDetails = false;
    }
  }

  async loadPosSessions(): Promise<void> {
    if (!this.isAdmin || !this.shop?.shopId) {
      return;
    }
    this.posSessionsLoading = true;
    try {
      const resp = await firstValueFrom(
        await this.posService.getSessionHistory(this.shop.shopId, this.posSessionsPage, this.posSessionsPageSize)
      );
      this.posSessions = resp?.content ?? [];
      this.posSessionsTotal = resp?.totalElements ?? 0;
    } catch (e) {
      console.error('Error loading POS session history:', e);
      this.posSessions = [];
      this.posSessionsTotal = 0;
    } finally {
      this.posSessionsLoading = false;
    }
  }

  onPosHistoryPageChange(event: { page: number; rows: number }): void {
    this.pageSizeService.onPage(TablePageSizeKeys.shopDetailsSessions, [10, 25, 50], event);
    this.posSessionsPage = event.page;
    this.posSessionsPageSize = event.rows;
    this.loadPosSessions();
  }

  cashRegisterSessionIdForPosRow(session: POSSessionDTO): number | null {
    return session.cashRegisterSessionId ?? session.cashRegisterSession?.sessionId ?? null;
  }

  async loadCashRegisterData(): Promise<void> {
    if (!this.shop?.shopId) return;
    try {
      this.cashRegisterData = await firstValueFrom(this.shopService.getCashRegister(this.shop.shopId));
    } catch (error) {
      console.error('Error loading cash register:', error);
      this.cashRegisterData = null;
    }
  }

  async loadOrganizationData(): Promise<void> {
    if (!this.shop?.shopId) return;
    try {
      this.organizationData = await firstValueFrom(this.shopService.fetchOrganizationData(this.shop.shopId));
    } catch (error) {
      console.error('Error loading organization:', error);
      this.organizationData = null;
    }
  }

  async loadPurchaseStats(): Promise<void> {
    if (!this.shop?.shopId) return;
    try {
      this.purchaseStats = await firstValueFrom(this.shopService.fetchPurchaseStats(this.shop.shopId));
    } catch (error) {
      console.error('Error loading purchase stats:', error);
      this.purchaseStats = { count: 0, total: 0 };
    }
  }

  async loadExpenseStats(): Promise<void> {
    if (!this.shop?.shopId) return;
    try {
      this.expenseStats = await firstValueFrom(this.shopService.fetchExpenseStats(this.shop.shopId));
    } catch (error) {
      console.error('Error loading expense stats:', error);
      this.expenseStats = { count: 0, total: 0 };
    }
  }

  async loadRecentPurchases(): Promise<void> {
    if (!this.shop?.shopId) return;
    this.loadingPurchases = true;
    try {
      this.recentPurchases = await firstValueFrom(this.shopService.fetchRecentPurchases(this.shop.shopId)) as Purchase[];
    } catch (error) {
      console.error('Error loading recent purchases:', error);
      this.recentPurchases = [];
    } finally {
      this.loadingPurchases = false;
    }
  }

  async loadRecentExpenses(): Promise<void> {
    if (!this.shop?.shopId) return;
    this.loadingExpenses = true;
    try {
      this.recentExpenses = await firstValueFrom(this.shopService.fetchRecentExpenses(this.shop.shopId)) as Expense[];
    } catch (error) {
      console.error('Error loading recent expenses:', error);
      this.recentExpenses = [];
    } finally {
      this.loadingExpenses = false;
    }
  }

  calculateShopStats(): void {
    const totalPurchases = this.purchaseStats?.total || 0;
    const totalExpenses = this.expenseStats?.total || 0;
    const cashBalance = this.cashRegisterData?.totalBalance || 0;
    const purchaseCount = this.purchaseStats?.count || 0;
    const expenseCount = this.expenseStats?.count || 0;
    const recentPurchasesTotal = this.recentPurchases?.reduce((sum, p) => sum + (p.totalAmount || 0), 0) || 0;
    const recentExpensesTotal = this.recentExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

    this.shopStats = {
      cashBalance: cashBalance,
      totalPurchases: totalPurchases,
      totalExpenses: totalExpenses,
      purchaseCount: purchaseCount,
      expenseCount: expenseCount,
      netCashFlow: cashBalance - totalExpenses,
      recentPurchasesTotal: recentPurchasesTotal,
      recentExpensesTotal: recentExpensesTotal,
      averagePurchaseAmount: purchaseCount > 0 ? totalPurchases / purchaseCount : 0,
      averageExpenseAmount: expenseCount > 0 ? totalExpenses / expenseCount : 0
    };
  }

  getPaymentMethodSeverity(method: string): string {
    switch (method?.toLowerCase()) {
      case 'cash':
        return 'success';
      case 'credit':
        return 'warning';
      case 'check':
        return 'help';
      case 'transfer':
        return 'info';
      default:
        return 'danger';
    }
  }

  goToCashRegister(): void {
    if (!this.shop?.shopId) {
      return;
    }
    void this.router.navigate(['/finance/treasury/cash-registers', this.shop.shopId]);
  }

  private async loadBankAccounts(): Promise<void> {
    try {
      const accounts$ = await this.bankAccountService.getBankAccounts(true);
      this.bankAccounts = await firstValueFrom(accounts$) as BankAccount[];
    } catch (error) {
      console.error('Error loading bank accounts:', error);
      this.bankAccounts = [];
    }
  }

  async editShop(): Promise<void> {
    if (!this.shop) return;
    await this.loadBankAccounts();
    let cashRegisterOpeningTime: Date | null = null;
    let cashRegisterClosingTime: Date | null = null;
    if (this.shop.shopId) {
      try {
        const register = await firstValueFrom(this.shopService.getCashRegister(this.shop.shopId)) as CashRegister;
        const schedule = parseCashRegisterSchedule(register?.openingTime, register?.closingTime);
        cashRegisterOpeningTime = schedule.openingTime ?? null;
        cashRegisterClosingTime = schedule.closingTime ?? null;
      } catch {
        /* ignore */
      }
    }
    this.shopDialogConfig = {
      visible: true,
      mode: 'edit',
      shop: { ...this.shop } as Shop,
      cashRegisterOpeningTime,
      cashRegisterClosingTime,
    };
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

  async saveShop(): Promise<void> {
    this.submitted = true;
    if (!this.shop?.shopName) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000,
      });
      return;
    }

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

    if (this.shop.shopId) {
      await this.updateShop(this.shop.shopId, this.shop);
    }
  }

  async updateShop(id: number, shop: Shop): Promise<void> {
    try {
      await firstValueFrom(this.shopService.updateShop(id, shop));
      await this.persistCashRegisterSchedule(id);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('shop_updated'),
        life: 3000,
      });
      this.shopDialogConfig.visible = false;
      this.pendingCashRegisterSchedule = null;
      await this.loadShop();
      await this.loadShopDetails();
      this.calculateShopStats();
    } catch (error) {
      console.error('Error updating shop:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_updating_shop'),
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

  goBack(): void {
    this.location.back();
  }
}

