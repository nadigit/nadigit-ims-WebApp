import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { LinePriceRule } from '../models/line-price-rule';
import { withAudit } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class LinePriceRuleService {
  private jwt: any;
  private readonly schema = '/api/line-price-rules';
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

  async list(): Promise<Observable<LinePriceRule[]>> {
    const headers = await this.getHeaders();
    return this.http.get<LinePriceRule[]>(this.baseUrl(), { headers });
  }

  async get(id: number): Promise<Observable<LinePriceRule>> {
    const headers = await this.getHeaders();
    return this.http.get<LinePriceRule>(`${this.baseUrl()}/${id}`, { headers });
  }

  async create(payload: LinePriceRule): Promise<Observable<LinePriceRule>> {
    const headers = withAudit(await this.getHeaders(), 'Created line price rule');
    return this.http.post<LinePriceRule>(this.baseUrl(), payload, { headers });
  }

  async update(id: number, payload: LinePriceRule): Promise<Observable<LinePriceRule>> {
    const headers = withAudit(await this.getHeaders(), 'Updated line price rule');
    return this.http.put<LinePriceRule>(`${this.baseUrl()}/${id}`, payload, { headers });
  }

  async remove(id: number): Promise<Observable<void>> {
    const headers = withAudit(await this.getHeaders(), 'Deleted line price rule');
    return this.http.delete<void>(`${this.baseUrl()}/${id}`, { headers });
  }
}
