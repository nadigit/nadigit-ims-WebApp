import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { ProfitAnalysis, ProfitPeriod } from './analysis.service';
import {
  InventorySnapshot,
  PurchaseSummary,
  SalesSummary,
  TopSellingProducts,
} from './reports.service';

export interface TopCustomerLine {
  customerId: number;
  displayName: string;
  email: string;
  revenue: number;
}

export interface PreviousPeriodSummary {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  grossProfit: number;
  /** Spoilage / inventory write-offs for the previous window (mirrors profit.totalWriteOffs). */
  writeOffs: number;
  netProfit: number;
}

/**
 * Consolidated admin dashboard payload — mirrors backend DashboardOverviewResponse.
 * One accurate call per window; all figures are backend-computed (no client-side reductions).
 */
export interface DashboardOverview {
  period: ProfitPeriod;
  startDate: string;
  endDate: string;
  generatedAt: string;
  shopName: string;
  profit: ProfitAnalysis;
  salesSummary: SalesSummary;
  purchaseSummary: PurchaseSummary;
  inventory: InventorySnapshot;
  topProducts: TopSellingProducts;
  topCustomers: TopCustomerLine[];
  previous: PreviousPeriodSummary;
  /** Point-in-time receivables across ALL open orders — NOT scoped by the period selector. */
  totalReceivables: number;
  /** Count of open (non-canceled, not fully paid) orders backing totalReceivables. */
  openReceivableOrderCount: number;
  /** Point-in-time payables across ALL open purchases — NOT scoped by the period selector. */
  totalPayables: number;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private jwt: any;
  private readonly basePath = '/api/dashboard';
  private readonly apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  private readonly apiHost: string = (window as any).__env.apiHost || 'localhost';
  private readonly apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, private keycloakService: KeycloakService) {}

  private async ensureTokenLoaded(): Promise<void> {
    if (!this.jwt) {
      this.jwt = await this.keycloakService.getToken();
    }
  }

  async getAdminOverview(
    period: ProfitPeriod,
    shopId?: number,
    warehouseId?: number
  ): Promise<Observable<DashboardOverview>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams().set('period', period);
    if (shopId != null) {
      params = params.set('shopId', shopId.toString());
    }
    if (warehouseId != null) {
      params = params.set('warehouseId', warehouseId.toString());
    }
    return this.http.get<DashboardOverview>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/admin/overview`,
      { headers, params }
    );
  }
}
