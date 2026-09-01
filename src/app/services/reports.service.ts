import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { ProfitPeriod } from './analysis.service';

export interface SalesSummary {
  period: string;
  startDate: string;
  endDate: string;
  completedOrderCount: number;
  totalRevenue: number;
  averageOrderValue: number;
  shopName: string;
  totalProductCost: number;
  totalRefunds: number;
  grossProfit: number;
  canceledOrderCount: number;
  returnedOrderCount: number;
  incompleteNonCanceledOrderCount: number;
  unpaidOrderCount: number;
  partiallyPaidOrderCount: number;
  fullyPaidOrderCount: number;
  totalOutstandingAmount: number;
}

export interface PurchaseSummary {
  period: string;
  startDate: string;
  endDate: string;
  purchaseCount: number;
  totalPurchaseAmount: number;
  averagePurchaseValue: number;
  shopName: string;
  totalLineItemsCost: number;
  totalPurchaseReturnCredits: number;
  netPurchaseAfterReturns: number;
  canceledPurchaseCount: number;
  returnedPurchaseCount: number;
  incompleteNonCanceledPurchaseCount: number;
  unpaidPurchaseCount: number;
  partiallyPaidPurchaseCount: number;
  fullyPaidPurchaseCount: number;
  totalOutstandingPurchaseAmount: number;
}

export interface VatRateLine {
  ratePercent: number;
  taxableBase: number;
  taxAmount: number;
  documentCount: number;
  returnedBase: number;
  returnedTax: number;
  netTax: number;
}

export interface VatDeclaration {
  fromDate: string;
  toDate: string;
  shopName: string;
  outputVat: VatRateLine[];
  totalOutputBase: number;
  totalOutputTax: number;
  totalOutputReturnedTax: number;
  netOutputTax: number;
  salesDocumentCount: number;
  inputVat: VatRateLine[];
  totalInputBase: number;
  totalInputTax: number;
  totalInputReturnedTax: number;
  netInputTax: number;
  purchaseDocumentCount: number;
  netVatPayable: number;
}

export interface InventorySituationLine {
  productId: number;
  reference: string;
  name: string;
  categoryName: string;
  warehouseName: string;
  quantityOnHand: number;
  measureUnit: string;
  measureUnitLabel?: string;
  unitCost: number;
  lineValue: number;
  inventoryStatus: string;
  inventoryStatusLabel?: string;
}

export interface InventorySituationDeltaLine {
  productId: number;
  reference: string;
  name: string;
  categoryName: string;
  warehouseName: string;
  quantityFrom: number;
  quantityTo: number;
  quantityDelta: number;
  measureUnit: string;
  measureUnitLabel?: string;
  unitCost: number;
  valueFrom: number;
  valueTo: number;
  valueDelta: number;
}

export interface InventorySituationDelta {
  fromDate: string;
  toDate: string;
  generatedAt: string;
  warehouseLabel: string;
  snapshotBackedFrom: boolean;
  snapshotBackedTo: boolean;
  disclaimer: string;
  changedSkuCount: number;
  totalQuantityDelta: number;
  totalValueDelta: number;
  includeZeroQuantity: boolean;
  onlyChanges: boolean;
  lines: InventorySituationDeltaLine[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface InventorySituation {
  asOfDate: string;
  generatedAt: string;
  warehouseLabel: string;
  totalSkuCount: number;
  totalUnitsOnHand: number;
  estimatedStockValue: number;
  includeZeroQuantity: boolean;
  snapshotBacked: boolean;
  ledgerDisclaimer: string;
  lines: InventorySituationLine[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface TopSellingProductLine {
  rank: number;
  productId: number;
  reference: string;
  name: string;
  categoryName: string;
  warehouseName: string;
  measureUnit: string;
  measureUnitLabel?: string;
  quantitySold: number;
  revenue: number;
}

export interface TopSellingProducts {
  period?: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  shopName: string;
  warehouseLabel?: string;
  limit: number;
  totalQuantitySold: number;
  totalRevenue: number;
  lines: TopSellingProductLine[];
}

export interface InventorySnapshot {
  generatedAt: string;
  activeSkuCount: number;
  totalUnitsOnHand: number;
  estimatedStockValue: number;
  lowStockSkuCount: number;
  outOfStockSkuCount: number;
  warehouseLabel: string;
  expirationWarningDaysUsed: number;
  writeOffLookbackDaysUsed: number;
  productSkusWithExpirationDate: number;
  productSkusExpiredByDate: number;
  productUnitsExpiredByDate: number;
  estimatedValueProductExpiredByDate: number;
  productSkusExpiringSoonByDate: number;
  productUnitsExpiringSoonByDate: number;
  estimatedValueProductExpiringSoon: number;
  expiredBatchRowCount: number;
  expiredBatchUnits: number;
  estimatedValueExpiredBatches: number;
  expiringSoonBatchRowCount: number;
  expiringSoonBatchUnits: number;
  estimatedValueExpiringSoonBatches: number;
  pendingWriteOffCount: number;
  pendingWriteOffQuantity: number;
  pendingWriteOffCost: number;
  approvedWriteOffLineCountLookback: number;
  approvedWriteOffQuantityLookback: number;
  approvedWriteOffCostLookback: number;
  approvedWriteOffDamagedQuantityLookback: number;
  approvedWriteOffDamagedCostLookback: number;
  approvedWriteOffLostQuantityLookback: number;
  approvedWriteOffLostCostLookback: number;
  approvedWriteOffExpiredQuantityLookback: number;
  approvedWriteOffExpiredCostLookback: number;
  approvedTheftWriteOffCountLookback: number;
  approvedTheftWriteOffQuantityLookback: number;
  approvedTheftWriteOffCostLookback: number;
}

export type StaffKpiRoleContext = 'CASHIER' | 'VENDOR' | 'WAREHOUSEMAN' | 'GENERIC';

export interface StaffPerformanceRow {
  appUserId: number;
  username: string;
  displayName: string;
  active: boolean;
  shopId: number | null;
  shopName: string | null;
  activeDays: number;
  /** Keyed by metric name; the keys to render come from StaffPerformance.metricKeys. */
  metrics: { [key: string]: number };
  previousMetrics: { [key: string]: number };
  rank: number | null;
}

export interface StaffPerformance {
  roleContext: StaffKpiRoleContext;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  /**
   * False when this deployment cannot produce the group (POS off, feature unlicensed, not yet
   * implemented). Render "not available" — never zeros, which read as "this person did nothing".
   */
  available: boolean;
  availabilityReason: 'AVAILABLE' | 'FEATURE_NOT_LICENSED' | 'MODULE_DISABLED' | 'NOT_IMPLEMENTED';
  metricKeys: string[];
  rows: StaffPerformanceRow[];
  teamTotals: { [key: string]: number };
  teamMedians: { [key: string]: number };
  leaderboardEnabled: boolean;
  leaderboardSuppressedReason: 'DISABLED_BY_CONFIGURATION' | 'TOO_FEW_MEMBERS' | null;
  rankedBy: string;
  /** Fraction of the window's activity with no user attribution (pre-backfill history). */
  unattributedShare: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private jwt: any;
  private readonly basePath = '/api/reports';
  private readonly apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  private readonly apiHost: string = (window as any).__env.apiHost || 'localhost';
  private readonly apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService
  ) {}

  private async ensureTokenLoaded(): Promise<void> {
    if (!this.jwt) {
      this.jwt = await this.keycloakService.getToken();
    }
  }

  async getSalesSummary(period: ProfitPeriod, shopId?: number): Promise<Observable<SalesSummary>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams().set('period', period);
    if (shopId != null) {
      params = params.set('shopId', shopId.toString());
    }
    return this.http.get<SalesSummary>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/sales/summary`,
      { headers, params }
    );
  }

  async getTopSellingProducts(
    options: {
      period?: ProfitPeriod;
      fromDate?: string;
      toDate?: string;
      shopId?: number;
      warehouseId?: number;
      limit?: number;
    }
  ): Promise<Observable<TopSellingProducts>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams().set('limit', String(options.limit ?? 20));
    if (options.period) {
      params = params.set('period', options.period);
    }
    if (options.fromDate) {
      params = params.set('fromDate', options.fromDate);
    }
    if (options.toDate) {
      params = params.set('toDate', options.toDate);
    }
    if (options.shopId != null) {
      params = params.set('shopId', options.shopId.toString());
    }
    if (options.warehouseId != null) {
      params = params.set('warehouseId', options.warehouseId.toString());
    }
    return this.http.get<TopSellingProducts>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/sales/top-products`,
      { headers, params }
    );
  }

  async downloadTopSellingProducts(
    options: {
      period?: ProfitPeriod;
      fromDate?: string;
      toDate?: string;
      shopId?: number;
      warehouseId?: number;
      limit?: number;
      format: 'csv' | 'excel';
    }
  ): Promise<Observable<any>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('limit', String(options.limit ?? 20))
      .set('format', options.format === 'excel' ? 'xlsx' : 'csv');
    if (options.period) {
      params = params.set('period', options.period);
    }
    if (options.fromDate) {
      params = params.set('fromDate', options.fromDate);
    }
    if (options.toDate) {
      params = params.set('toDate', options.toDate);
    }
    if (options.shopId != null) {
      params = params.set('shopId', options.shopId.toString());
    }
    if (options.warehouseId != null) {
      params = params.set('warehouseId', options.warehouseId.toString());
    }
    return this.http.get(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/sales/top-products/export`,
      { headers, params, responseType: 'blob' as 'blob', observe: 'response' }
    );
  }

  async getPurchaseSummary(period: ProfitPeriod, shopId?: number): Promise<Observable<PurchaseSummary>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams().set('period', period);
    if (shopId != null) {
      params = params.set('shopId', shopId.toString());
    }
    return this.http.get<PurchaseSummary>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/purchases/summary`,
      { headers, params }
    );
  }

  async getVatDeclaration(fromDate: string, toDate: string, shopId?: number): Promise<Observable<VatDeclaration>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams().set('fromDate', fromDate).set('toDate', toDate);
    if (shopId != null) {
      params = params.set('shopId', shopId.toString());
    }
    return this.http.get<VatDeclaration>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/vat/declaration`,
      { headers, params }
    );
  }

  async downloadVatDeclaration(
    fromDate: string,
    toDate: string,
    format: 'csv' | 'excel',
    shopId?: number
  ): Promise<Observable<any>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('fromDate', fromDate)
      .set('toDate', toDate)
      .set('format', format === 'excel' ? 'xlsx' : 'csv');
    if (shopId != null) {
      params = params.set('shopId', shopId.toString());
    }
    return this.http.get(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/vat/declaration/export`,
      { headers, params, responseType: 'blob' as 'blob', observe: 'response' }
    );
  }

  async getInventorySnapshot(
    warehouseId?: number,
    expirationWarningDays = 30,
    writeOffLookbackDays = 90
  ): Promise<Observable<InventorySnapshot>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('expirationWarningDays', String(expirationWarningDays))
      .set('writeOffLookbackDays', String(writeOffLookbackDays));
    if (warehouseId != null) {
      params = params.set('warehouseId', warehouseId.toString());
    }
    return this.http.get<InventorySnapshot>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/inventory/snapshot`,
      { headers, params }
    );
  }

  async getInventorySituation(
    asOf: string,
    warehouseId?: number,
    includeZeroQuantity = false,
    page = 0,
    size = 50
  ): Promise<Observable<InventorySituation>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('asOf', asOf)
      .set('includeZeroQuantity', String(includeZeroQuantity))
      .set('page', String(page))
      .set('size', String(size));
    if (warehouseId != null) {
      params = params.set('warehouseId', warehouseId.toString());
    }
    return this.http.get<InventorySituation>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/inventory/situation`,
      { headers, params }
    );
  }

  async downloadInventorySituation(
    asOf: string,
    format: 'csv' | 'excel' | 'pdf',
    warehouseId?: number,
    includeZeroQuantity = false
  ): Promise<Observable<any>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('asOf', asOf)
      .set('includeZeroQuantity', String(includeZeroQuantity))
      .set('format', format === 'excel' ? 'xlsx' : format);
    if (warehouseId != null) {
      params = params.set('warehouseId', warehouseId.toString());
    }
    return this.http.get(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/inventory/situation/export`,
      { headers, params, responseType: 'blob' as 'blob', observe: 'response' }
    );
  }

  async getInventorySituationDelta(
    fromDate: string,
    toDate: string,
    warehouseId?: number,
    includeZeroQuantity = false,
    onlyChanges = true,
    page = 0,
    size = 50
  ): Promise<Observable<InventorySituationDelta>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('fromDate', fromDate)
      .set('toDate', toDate)
      .set('includeZeroQuantity', String(includeZeroQuantity))
      .set('onlyChanges', String(onlyChanges))
      .set('page', String(page))
      .set('size', String(size));
    if (warehouseId != null) {
      params = params.set('warehouseId', warehouseId.toString());
    }
    return this.http.get<InventorySituationDelta>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/inventory/situation/delta`,
      { headers, params }
    );
  }

  async downloadInventorySituationDelta(
    fromDate: string,
    toDate: string,
    format: 'csv' | 'excel' | 'pdf',
    warehouseId?: number,
    includeZeroQuantity = false,
    onlyChanges = true
  ): Promise<Observable<any>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('fromDate', fromDate)
      .set('toDate', toDate)
      .set('includeZeroQuantity', String(includeZeroQuantity))
      .set('onlyChanges', String(onlyChanges))
      .set('format', format === 'excel' ? 'xlsx' : format);
    if (warehouseId != null) {
      params = params.set('warehouseId', warehouseId.toString());
    }
    return this.http.get(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/inventory/situation/delta/export`,
      { headers, params, responseType: 'blob' as 'blob', observe: 'response' }
    );
  }

  async getStaffPerformance(
    roleContext: StaffKpiRoleContext,
    from: string,
    to: string,
    opts: { userId?: number; shopId?: number; warehouseId?: number; rankBy?: string } = {}
  ): Promise<Observable<StaffPerformance>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams().set('roleContext', roleContext).set('from', from).set('to', to);
    if (opts.userId != null) params = params.set('userId', opts.userId.toString());
    if (opts.shopId != null) params = params.set('shopId', opts.shopId.toString());
    if (opts.warehouseId != null) params = params.set('warehouseId', opts.warehouseId.toString());
    if (opts.rankBy) params = params.set('rankBy', opts.rankBy);
    return this.http.get<StaffPerformance>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/staff/performance`,
      { headers, params }
    );
  }

  async getStaffTrend(
    userId: number,
    roleContext: StaffKpiRoleContext,
    from: string,
    to: string
  ): Promise<Observable<Array<{ [key: string]: any }>>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    const params = new HttpParams().set('roleContext', roleContext).set('from', from).set('to', to);
    return this.http.get<Array<{ [key: string]: any }>>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/staff/performance/${userId}/trend`,
      { headers, params }
    );
  }

  /** Downloads the staff report as csv or xlsx. */
  async exportStaffPerformance(
    roleContext: StaffKpiRoleContext,
    from: string,
    to: string,
    format: 'csv' | 'xlsx' = 'csv',
    opts: { shopId?: number; warehouseId?: number; rankBy?: string } = {}
  ): Promise<Observable<Blob>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('roleContext', roleContext)
      .set('from', from)
      .set('to', to)
      .set('format', format);
    if (opts.shopId != null) params = params.set('shopId', opts.shopId.toString());
    if (opts.warehouseId != null) params = params.set('warehouseId', opts.warehouseId.toString());
    if (opts.rankBy) params = params.set('rankBy', opts.rankBy);
    return this.http.get(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/staff/performance/export`,
      { headers, params, responseType: 'blob' }
    );
  }

  /** Rebuilds staff KPI facts for a date range (ADMIN). Used to load history after the backfill. */
  async recomputeStaffSnapshots(from: string, to: string): Promise<Observable<any>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.post<any>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/staff/snapshots/recompute`,
      null,
      { headers, params }
    );
  }
}
