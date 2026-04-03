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
}
