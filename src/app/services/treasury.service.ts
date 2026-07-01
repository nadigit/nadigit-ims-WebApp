import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom } from 'rxjs';
import { ShopService } from './shop.service';
import { CashRegisterService } from './cash-register.service';
import { BankAccountService } from './bank-account.service';
import { CustomerCreditService } from './customer-credit.service';
import { Shop } from '../models/shop';
import { CashRegister } from '../models/cashRegister';
import { CashRegisterSession } from '../models/cashRegisterSession';
import { CashMovement } from '../models/cashMovement';
import { CashCollection } from '../models/cashCollection';
import { BankAccount } from '../models/bank-account';
import {
  TreasuryActivityItem,
  TreasuryCashFlowRow,
  TreasuryOverviewData,
  TreasuryOverviewLoadOptions,
  TreasuryRegisterSnapshot,
} from '../models/treasury-overview';

interface TreasuryOverviewApiDto {
  totalCashBalance?: number;
  totalBankBalance?: number;
  outstandingCreditBalance?: number;
  netLiquidity?: number;
  openRegistersCount?: number;
  closedRegistersCount?: number;
  bankAccountsCount?: number;
  customersWithCredit?: number;
  totalCollectionsInPeriod?: number;
  unlinkedRegistersCount?: number;
  activityDays?: number;
  registerSnapshots?: TreasuryRegisterSnapshot[];
  cashFlowRows?: Array<Omit<TreasuryCashFlowRow, 'collectionsInPeriod'> & { collectionsInPeriod?: number; collectionsLast7Days?: number }>;
  recentActivity?: Array<Omit<TreasuryActivityItem, 'timestamp'> & { timestamp: string | Date }>;
}

@Injectable({
  providedIn: 'root',
})
export class TreasuryService {
  private schema = '/api/treasury/';
  private apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  private apiHost: string = (window as any).__env.apiHost || 'localhost';
  private apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService,
    private shopService: ShopService,
    private cashRegisterService: CashRegisterService,
    private bankAccountService: BankAccountService,
    private customerCreditService: CustomerCreditService,
  ) {}

  async loadOverview(options: TreasuryOverviewLoadOptions): Promise<TreasuryOverviewData> {
    const activityDays = options.activityDays ?? 7;
    const aggregate = await this.tryLoadAggregateOverview(options, activityDays);
    if (aggregate) {
      return aggregate;
    }
    return this.loadOverviewClientSide(options, activityDays);
  }

  private async tryLoadAggregateOverview(
    options: TreasuryOverviewLoadOptions,
    activityDays: number,
  ): Promise<TreasuryOverviewData | null> {
    try {
      const headers = await this.getAuthHeaders();
      let params = new HttpParams().set('days', activityDays.toString());
      if (options.includeCash === false) {
        params = params.set('includeCash', 'false');
      }
      if (options.includeBank === false) {
        params = params.set('includeBank', 'false');
      }
      if (options.includeCredit === false) {
        params = params.set('includeCredit', 'false');
      }

      const dto = await firstValueFrom(
        this.http.get<TreasuryOverviewApiDto>(
          `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}overview`,
          { headers, params },
        ),
      );

      if (!dto || !Array.isArray(dto.registerSnapshots)) {
        return null;
      }

      const cashFlowRows = (dto.cashFlowRows || []).map(row => ({
        shopId: row.shopId,
        shopName: row.shopName,
        registerBalance: row.registerBalance ?? 0,
        bankAccountId: row.bankAccountId,
        bankAccountName: row.bankAccountName,
        collectionsInPeriod: row.collectionsInPeriod ?? row.collectionsLast7Days ?? 0,
        hasLinkedBank: row.hasLinkedBank ?? row.bankAccountId != null,
      }));

      const recentActivity = (dto.recentActivity || []).map(item => ({
        ...item,
        timestamp: item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp),
      }));

      const totalCashBalance = dto.totalCashBalance ?? dto.registerSnapshots.reduce((sum, s) => sum + (s.balance || 0), 0);
      const totalBankBalance = dto.totalBankBalance ?? 0;
      const canIncludeBank = options.includeBank !== false;

      return {
        totalCashBalance,
        totalBankBalance,
        outstandingCreditBalance: dto.outstandingCreditBalance ?? 0,
        netLiquidity: dto.netLiquidity ?? totalCashBalance + (canIncludeBank ? totalBankBalance : 0),
        openRegistersCount: dto.openRegistersCount ?? dto.registerSnapshots.filter(s => s.isOpen).length,
        closedRegistersCount: dto.closedRegistersCount ?? dto.registerSnapshots.filter(s => !s.isOpen).length,
        bankAccountsCount: dto.bankAccountsCount ?? 0,
        customersWithCredit: dto.customersWithCredit ?? 0,
        totalCollectionsInPeriod: dto.totalCollectionsInPeriod ?? cashFlowRows.reduce((sum, r) => sum + r.collectionsInPeriod, 0),
        unlinkedRegistersCount: dto.unlinkedRegistersCount ?? cashFlowRows.filter(r => !r.hasLinkedBank).length,
        activityDays: dto.activityDays ?? activityDays,
        registerSnapshots: dto.registerSnapshots,
        cashFlowRows,
        recentActivity,
        loadedFromAggregateApi: true,
      };
    } catch {
      return null;
    }
  }

  private async loadOverviewClientSide(
    options: TreasuryOverviewLoadOptions,
    activityDays: number,
  ): Promise<TreasuryOverviewData> {
    const includeCash = options.includeCash !== false;
    const includeBank = options.includeBank !== false;
    const includeCredit = options.includeCredit !== false;
    const periodStart = this.daysAgo(activityDays);

    let registerSnapshots: TreasuryRegisterSnapshot[] = [];
    let cashFlowRows: TreasuryCashFlowRow[] = [];
    let recentActivity: TreasuryActivityItem[] = [];
    let totalBankBalance = 0;
    let bankAccountsCount = 0;
    let outstandingCreditBalance = 0;
    let customersWithCredit = 0;

    const [shopsResult, bankResult, creditResult] = await Promise.allSettled([
      includeCash ? this.loadShops() : Promise.resolve([] as Shop[]),
      includeBank ? this.loadBankAccounts() : Promise.resolve([] as BankAccount[]),
      includeCredit ? this.loadCreditSummary() : Promise.resolve({ outstandingCreditBalance: 0, customersWithCredit: 0 }),
    ]);

    const shopList = shopsResult.status === 'fulfilled' && Array.isArray(shopsResult.value) ? shopsResult.value : [];
    const bankAccounts = bankResult.status === 'fulfilled' && Array.isArray(bankResult.value) ? bankResult.value : [];
    const bankAccountsMap = new Map<number, BankAccount>();
    bankAccounts.forEach(account => {
      if (account.accountId != null) {
        bankAccountsMap.set(account.accountId, account);
      }
    });

    if (creditResult.status === 'fulfilled') {
      outstandingCreditBalance = creditResult.value.outstandingCreditBalance;
      customersWithCredit = creditResult.value.customersWithCredit;
    }

    if (includeBank) {
      const activeAccounts = bankAccounts.filter(a => a.active !== false);
      bankAccountsCount = activeAccounts.length;
      totalBankBalance = activeAccounts.reduce((sum, a) => sum + (a.currentBalance ?? a.openingBalance ?? 0), 0);
    }

    if (includeCash && shopList.length) {
      const shopData = await Promise.all(
        shopList.map(async (shop) => this.loadShopTreasuryData(shop, periodStart)),
      );

      registerSnapshots = shopData.map(d => d.snapshot);
      cashFlowRows = shopData.map(d => {
        const bankId = d.shop.defaultBankAccount?.accountId ?? d.shop.defaultBankAccountId;
        const bank = bankId != null ? bankAccountsMap.get(bankId) : undefined;
        return {
          shopId: d.shop.shopId!,
          shopName: d.shop.shopName || '',
          registerBalance: d.snapshot.balance,
          bankAccountId: bankId,
          bankAccountName: bank?.accountName,
          collectionsInPeriod: d.collectionsInPeriod,
          hasLinkedBank: bankId != null,
        };
      }).sort((a, b) => b.collectionsInPeriod - a.collectionsInPeriod);

      recentActivity = shopData
        .flatMap(d => d.activityItems)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 15);
    }

    const openRegisters = registerSnapshots.filter(s => s.isOpen);
    const totalCashBalance = registerSnapshots.reduce((sum, s) => sum + s.balance, 0);
    const totalCollectionsInPeriod = cashFlowRows.reduce((sum, r) => sum + r.collectionsInPeriod, 0);

    return {
      totalCashBalance,
      totalBankBalance,
      outstandingCreditBalance,
      netLiquidity: totalCashBalance + (includeBank ? totalBankBalance : 0),
      openRegistersCount: openRegisters.length,
      closedRegistersCount: registerSnapshots.length - openRegisters.length,
      bankAccountsCount,
      customersWithCredit,
      totalCollectionsInPeriod,
      unlinkedRegistersCount: cashFlowRows.filter(r => !r.hasLinkedBank).length,
      activityDays,
      registerSnapshots,
      cashFlowRows,
      recentActivity,
      loadedFromAggregateApi: false,
    };
  }

  private async loadShopTreasuryData(shop: Shop, periodStart: Date): Promise<{
    shop: Shop;
    snapshot: TreasuryRegisterSnapshot;
    collectionsInPeriod: number;
    activityItems: TreasuryActivityItem[];
  }> {
    const shopId = shop.shopId!;
    const shopName = shop.shopName || '';
    let balance = 0;
    let closingTime: string | undefined;
    let currentSession: CashRegisterSession | null = null;
    let collectionsInPeriod = 0;
    const activityItems: TreasuryActivityItem[] = [];

    const [registerResult, sessionResult, movementsResult, collectionsResult] = await Promise.allSettled([
      firstValueFrom(this.shopService.getCashRegister(shopId)) as Promise<CashRegister>,
      firstValueFrom(await this.cashRegisterService.getCurrentSessionByShop(shopId)),
      firstValueFrom(this.cashRegisterService.getMovementsByShop(shopId)),
      firstValueFrom(this.cashRegisterService.getCollectionsByShop(shopId)),
    ]);

    if (registerResult.status === 'fulfilled') {
      balance = registerResult.value?.totalBalance ?? 0;
      closingTime = this.normalizeClosingTime(registerResult.value?.closingTime);
    }

    if (sessionResult.status === 'fulfilled') {
      currentSession = sessionResult.value;
    }

    if (movementsResult.status === 'fulfilled') {
      (movementsResult.value || []).forEach((movement: CashMovement) => {
        const timestamp = movement.timestamp ? new Date(movement.timestamp) : null;
        if (!timestamp || timestamp < periodStart) {
          return;
        }
        // Skip COLLECTION movements — the matching collection record is added below (avoids duplicate rows).
        if (movement.type === 'COLLECTION') {
          return;
        }
        activityItems.push({
          kind: 'MOVEMENT',
          shopId,
          shopName,
          label: movement.type || 'MOVEMENT',
          amount: movement.amount || 0,
          timestamp,
          movementType: movement.type,
          performedBy: movement.performedByName,
        });
      });
    }

    if (collectionsResult.status === 'fulfilled') {
      (collectionsResult.value || []).forEach((collection: CashCollection) => {
        const timestamp = collection.collectedAt ? new Date(collection.collectedAt) : null;
        if (!timestamp || timestamp < periodStart) {
          return;
        }
        const amount = collection.amountCollected || 0;
        collectionsInPeriod += amount;
        activityItems.push({
          kind: 'COLLECTION',
          shopId,
          shopName,
          label: 'COLLECTION',
          amount,
          timestamp,
          performedBy: collection.collectedByName,
        });
      });
    }

    const isOpen = !!currentSession && !currentSession.closed;

    return {
      shop,
      snapshot: {
        shopId,
        shopName,
        balance,
        isOpen,
        openedAt: currentSession?.openedAt,
        openedBy: currentSession?.username || currentSession?.fullName,
        closingTime,
        pastClosingTime: isOpen && this.isPastClosingTime(closingTime),
      },
      collectionsInPeriod,
      activityItems,
    };
  }

  private async loadShops(): Promise<Shop[]> {
    await this.shopService.loadToken();
    const shops = await firstValueFrom(this.shopService.getShops());
    return Array.isArray(shops) ? shops as Shop[] : [];
  }

  private async loadBankAccounts(): Promise<BankAccount[]> {
    const accounts$ = await this.bankAccountService.getBankAccounts(true);
    const accounts = await firstValueFrom(accounts$);
    return Array.isArray(accounts) ? accounts : [];
  }

  private async loadCreditSummary(): Promise<{ outstandingCreditBalance: number; customersWithCredit: number }> {
    try {
      this.customerCreditService.loadToken();
      const accounts$ = await this.customerCreditService.getAllCreditAccounts();
      const accounts = await firstValueFrom(accounts$);
      const list = accounts || [];
      return {
        outstandingCreditBalance: list.reduce((sum, acc) => sum + (acc.creditBalance || 0), 0),
        customersWithCredit: list.filter(acc => (acc.creditBalance || 0) > 0).length,
      };
    } catch {
      return { outstandingCreditBalance: 0, customersWithCredit: 0 };
    }
  }

  private async getAuthHeaders(): Promise<HttpHeaders> {
    const token = await this.keycloakService.getToken();
    return new HttpHeaders({ Authorization: 'Bearer ' + token });
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  private normalizeClosingTime(value: string | Date | undefined): string | undefined {
    if (!value) {
      return undefined;
    }
    if (typeof value === 'string') {
      return value.split(':').slice(0, 2).join(':');
    }
    const h = String(value.getHours()).padStart(2, '0');
    const m = String(value.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  private isPastClosingTime(closingTime: string | undefined): boolean {
    if (!closingTime) {
      return false;
    }
    const [hours, minutes] = closingTime.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return false;
    }
    const now = new Date();
    const closingToday = new Date();
    closingToday.setHours(hours, minutes, 0, 0);
    return now > closingToday;
  }
}
