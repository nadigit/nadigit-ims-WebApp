import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { LineOptionSet } from '../models/line-option-set';
import { withAudit } from '../utils/audit-action';

/** CRUD for sale-line option sets (Capability A). Mirrors {@link TaxRuleService}'s HTTP conventions. */
@Injectable({
  providedIn: 'root'
})
export class LineOptionSetService {
  private jwt: any;
  private readonly schema = '/api/line-option-sets';
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

  async list(): Promise<Observable<LineOptionSet[]>> {
    const headers = await this.getHeaders();
    return this.http.get<LineOptionSet[]>(this.baseUrl(), { headers });
  }

  async get(id: number): Promise<Observable<LineOptionSet>> {
    const headers = await this.getHeaders();
    return this.http.get<LineOptionSet>(`${this.baseUrl()}/${id}`, { headers });
  }

  /** Active sets scoped to a specific product. */
  async forProduct(productId: number): Promise<Observable<LineOptionSet[]>> {
    const headers = await this.getHeaders();
    return this.http.get<LineOptionSet[]>(`${this.baseUrl()}/product/${productId}`, { headers });
  }

  /** Active sets scoped to a specific category. */
  async forCategory(categoryId: number): Promise<Observable<LineOptionSet[]>> {
    const headers = await this.getHeaders();
    return this.http.get<LineOptionSet[]>(`${this.baseUrl()}/category/${categoryId}`, { headers });
  }

  async create(payload: LineOptionSet): Promise<Observable<LineOptionSet>> {
    const headers = withAudit(await this.getHeaders(), 'Created line option set');
    return this.http.post<LineOptionSet>(this.baseUrl(), payload, { headers });
  }

  async update(id: number, payload: LineOptionSet): Promise<Observable<LineOptionSet>> {
    const headers = withAudit(await this.getHeaders(), 'Updated line option set');
    return this.http.put<LineOptionSet>(`${this.baseUrl()}/${id}`, payload, { headers });
  }

  async remove(id: number): Promise<Observable<void>> {
    const headers = withAudit(await this.getHeaders(), 'Deleted line option set');
    return this.http.delete<void>(`${this.baseUrl()}/${id}`, { headers });
  }
}
