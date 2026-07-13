import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { TaxRule } from '../models/tax-rule';
import { withAudit } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class TaxRuleService {
  private jwt: any;
  private readonly schema = '/api/tax-rules';
  private readonly apiProtocol: string = (window as any).__env?.apiProtocol || 'http';
  private readonly apiHost: string = (window as any).__env?.apiHost || 'localhost';
  private readonly apiPort: string = (window as any).__env?.apiPort || '8090';

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService
  ) {}

  private async ensureTokenLoaded(): Promise<void> {
    if (!this.jwt) {
      this.jwt = await this.keycloakService.getToken();
    }
  }

  private async getHeaders(): Promise<HttpHeaders> {
    await this.ensureTokenLoaded();
    return new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
  }

  private baseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  }

  async listTaxRules(): Promise<Observable<TaxRule[]>> {
    const headers = await this.getHeaders();
    return this.http.get<TaxRule[]>(this.baseUrl(), { headers });
  }

  async createTaxRule(payload: TaxRule): Promise<Observable<TaxRule>> {
    const headers = withAudit(await this.getHeaders(), 'Created tax rule');
    return this.http.post<TaxRule>(this.baseUrl(), payload, { headers });
  }

  async updateTaxRule(id: number, payload: TaxRule): Promise<Observable<TaxRule>> {
    const headers = withAudit(await this.getHeaders(), 'Updated tax rule');
    return this.http.put<TaxRule>(`${this.baseUrl()}/${id}`, payload, { headers });
  }

  async deleteTaxRule(id: number): Promise<Observable<void>> {
    const headers = withAudit(await this.getHeaders(), 'Deleted tax rule');
    return this.http.delete<void>(`${this.baseUrl()}/${id}`, { headers });
  }

  /**
   * Previews per-line resolved tax rates and the net-weighted effective rate.
   * Mirrors backend calculation so forms can display accurate totals pre-save.
   */
  async resolveTaxRates(payload: TaxResolveRequest): Promise<Observable<TaxResolveResponse>> {
    const headers = await this.getHeaders();
    return this.http.post<TaxResolveResponse>(`${this.baseUrl()}/resolve`, payload, { headers });
  }

  // ---------------------------------------------------------------------------
  // Simple per-product / per-category VAT assignment (item forms convenience).
  // ---------------------------------------------------------------------------

  /** Current simple product VAT rule; the observable emits null when none exists (204). */
  async getProductVatRule(productId: number): Promise<Observable<TaxRule | null>> {
    const headers = await this.getHeaders();
    return this.http.get<TaxRule | null>(`${this.baseUrl()}/product/${productId}`, { headers });
  }

  async setProductVatRule(productId: number, rate: number): Promise<Observable<TaxRule>> {
    const headers = withAudit(await this.getHeaders(), 'Assigned product VAT rate');
    return this.http.put<TaxRule>(`${this.baseUrl()}/product/${productId}`, { rate }, { headers });
  }

  async clearProductVatRule(productId: number): Promise<Observable<void>> {
    const headers = withAudit(await this.getHeaders(), 'Cleared product VAT rate');
    return this.http.delete<void>(`${this.baseUrl()}/product/${productId}`, { headers });
  }

  /** Current simple category VAT rule; the observable emits null when none exists (204). */
  async getCategoryVatRule(categoryId: number): Promise<Observable<TaxRule | null>> {
    const headers = await this.getHeaders();
    return this.http.get<TaxRule | null>(`${this.baseUrl()}/category/${categoryId}`, { headers });
  }

  async setCategoryVatRule(categoryId: number, rate: number): Promise<Observable<TaxRule>> {
    const headers = withAudit(await this.getHeaders(), 'Assigned category VAT rate');
    return this.http.put<TaxRule>(`${this.baseUrl()}/category/${categoryId}`, { rate }, { headers });
  }

  async clearCategoryVatRule(categoryId: number): Promise<Observable<void>> {
    const headers = withAudit(await this.getHeaders(), 'Cleared category VAT rate');
    return this.http.delete<void>(`${this.baseUrl()}/category/${categoryId}`, { headers });
  }
}

export interface TaxResolveRequest {
  documentType: 'SALES' | 'PURCHASE';
  customerId?: number | null;
  supplierId?: number | null;
  shopId?: number | null;
  /** Simulator: explicit country context instead of a concrete customer/supplier. */
  country?: string | null;
  lines: { productId: number; netAmount?: number | null }[];
}

export interface TaxResolveResponse {
  mode: 'GLOBAL' | 'RULES';
  effectiveRate: number;
  lines: TaxResolveLine[];
}

export interface TaxResolveLine {
  productId: number;
  /** Rate the system will actually apply in the current mode. */
  rate: number;
  /** Best-matching rule regardless of mode (null = global fallback). */
  ruleId?: number | null;
  ruleCode?: string | null;
  ruleLabel?: string | null;
  ruleRate?: number | null;
}
