import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, catchError, throwError } from 'rxjs';
import { withAudit } from '../utils/audit-action';
import {
  EcommerceConnectionTest,
  EcommerceConnectorBundle,
  EcommerceIntegration,
  EcommerceIntegrationHealth,
  EcommerceIntegrationRequest,
} from '../models/ecommerce-integration';

/**
 * Admin API for the Settings → Integrations console (multi-platform, multi-store storefront registry).
 * Backs {@code /api/ecommerce/admin/integrations} — ADMIN-only, ENTERPRISE-gated on the server.
 */
@Injectable({ providedIn: 'root' })
export class EcommerceIntegrationService {
  jwt: any;
  schema = '/api/ecommerce/admin/integrations';
  apiProtocol: string = (window as any).__env?.apiProtocol || 'http';
  apiHost: string = (window as any).__env?.apiHost || 'localhost';
  apiPort: string = (window as any).__env?.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) {}

  async loadToken(): Promise<void> {
    this.jwt = await this.keycloakService.getToken();
  }

  private baseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: 'Bearer ' + this.jwt, 'Content-Type': 'application/json' });
  }

  list(): Observable<EcommerceIntegration[]> {
    return this.http
      .get<EcommerceIntegration[]>(this.baseUrl(), { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  get(id: number): Observable<EcommerceIntegration> {
    return this.http
      .get<EcommerceIntegration>(`${this.baseUrl()}/${id}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  create(body: EcommerceIntegrationRequest): Observable<EcommerceIntegration> {
    return this.http
      .post<EcommerceIntegration>(this.baseUrl(), body, {
        headers: withAudit(this.getHeaders(), 'Created e-commerce integration'),
      })
      .pipe(catchError(this.handleError));
  }

  update(id: number, body: EcommerceIntegrationRequest): Observable<EcommerceIntegration> {
    return this.http
      .put<EcommerceIntegration>(`${this.baseUrl()}/${id}`, body, {
        headers: withAudit(this.getHeaders(), 'Updated e-commerce integration'),
      })
      .pipe(catchError(this.handleError));
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl()}/${id}`, {
        headers: withAudit(this.getHeaders(), 'Deleted e-commerce integration'),
      })
      .pipe(catchError(this.handleError));
  }

  /** Provision the connector identity in Keycloak and get the ready-to-import config bundle. */
  provision(id: number): Observable<EcommerceConnectorBundle> {
    return this.http
      .post<EcommerceConnectorBundle>(`${this.baseUrl()}/${id}/provision`, {}, {
        headers: withAudit(this.getHeaders(), 'Provisioned e-commerce connector'),
      })
      .pipe(catchError(this.handleError));
  }

  /** Health of every integration (last inbound/outbound sync + provisioned flags). */
  health(): Observable<EcommerceIntegrationHealth[]> {
    return this.http
      .get<EcommerceIntegrationHealth[]>(`${this.baseUrl()}/health`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /** Live reachability probe against the integration's storefront URL. */
  testConnection(id: number): Observable<EcommerceConnectionTest> {
    return this.http
      .post<EcommerceConnectionTest>(`${this.baseUrl()}/${id}/test`, {}, {
        headers: withAudit(this.getHeaders(), 'Tested e-commerce storefront connection'),
      })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any) {
    console.error('EcommerceIntegrationService error:', error);
    return throwError(() => error);
  }
}
