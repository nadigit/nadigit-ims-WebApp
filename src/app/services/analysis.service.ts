import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export enum ProfitPeriod {
  TODAY = 'TODAY',
  YESTERDAY = 'YESTERDAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  LAST_SIX_MONTHS = 'LAST_SIX_MONTHS',
  YEAR = 'YEAR',
  LAST_12_MONTHS = 'LAST_12_MONTHS'
}

export interface ProfitAnalysis {
  period: ProfitPeriod;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalCosts: number;
  totalRefunds: number;
  totalExpenses: number;
  totalPurchases: number;
  grossProfit: number;
  netProfit: number;
  shopName: string;
}

export interface Shop {
  shopId: any;
  shopName: any;
  id: number;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class AnalysisService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/analysis/profit";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';


  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  private async ensureTokenLoaded(): Promise<void> {
    if (!this.jwt) {
      this.jwt = await this.keycloakService.getToken();
    }
  }

  async getProfitAnalysis(period: ProfitPeriod, shopId?: number): Promise<Observable<ProfitAnalysis>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });

    let params = new HttpParams().set('period', period);

    if (shopId) {
      params = params.set('shopId', shopId.toString());
    }

    return this.http.get<ProfitAnalysis>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`,
      { headers, params }
    );
  }

  async getShops(): Promise<Observable<Shop[]>> {
    await this.ensureTokenLoaded();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get<Shop[]>(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + '/shops', { headers: headers });
  }


  async getProfitTrends(period: ProfitPeriod, shopId?: number): Promise<Observable<ProfitAnalysis>> {
    await this.ensureTokenLoaded();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    const params: any = { period };
    if (shopId) params.shopId = shopId;
    return this.http.get<ProfitAnalysis>(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + '/trends', { headers: headers, params: params });
  }

}
