import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, catchError, throwError } from 'rxjs';
import { WhatsAppConfigResponse, WhatsAppConfigUpdate } from '../models/whatsapp-config';
import { withAudit } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class WhatsAppConfigService {
  jwt: any;
  schema = '/api/whatsapp/config';
  apiProtocol: string = (window as any).__env?.apiProtocol || 'http';
  apiHost: string = (window as any).__env?.apiHost || 'localhost';
  apiPort: string = (window as any).__env?.apiPort || '8090';

  constructor(
    private http: HttpClient,
    public keycloakService: KeycloakService
  ) { }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  private getBaseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  }

  private getHeaders(): HttpHeaders {
    this.loadToken();
    return new HttpHeaders({
      'Authorization': 'Bearer ' + this.jwt,
      'Content-Type': 'application/json'
    });
  }

  getConfig(): Observable<WhatsAppConfigResponse> {
    return this.http.get<WhatsAppConfigResponse>(this.getBaseUrl(), { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  updateConfig(body: WhatsAppConfigUpdate): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.getBaseUrl(), body, {
      headers: withAudit(this.getHeaders(), 'Updated WhatsApp notification configuration')
    }).pipe(
      catchError(this.handleError)
    );
  }

  sendTest(to: string, message?: string): Observable<{ message: string }> {
    let params = new HttpParams().set('to', to);
    if (message && message.trim()) {
      params = params.set('message', message.trim());
    }
    return this.http.post<{ message: string }>(`${this.getBaseUrl()}/test`, {}, {
      headers: withAudit(this.getHeaders(), 'Sent WhatsApp test message'),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
    const errorMessage = error.error instanceof ErrorEvent
      ? `Error: ${error.error.message}`
      : `Error Code: ${error.status}\nMessage: ${error.message}`;
    console.error(errorMessage);
    return throwError(() => error);
  }
}
