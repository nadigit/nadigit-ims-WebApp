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
}
