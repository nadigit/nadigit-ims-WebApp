import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, catchError, throwError } from 'rxjs';
import { EmailConfig } from '../models/email-config';
import { withAudit } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class EmailConfigService {
  jwt: any;
  schema: string = '/api/email/config';
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

  getConfig(): Observable<EmailConfig> {
    return this.http.get<EmailConfig>(this.getBaseUrl(), { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  updateConfig(config: EmailConfig): Observable<EmailConfig> {
    return this.http.post<EmailConfig>(this.getBaseUrl(), config, { headers: withAudit(this.getHeaders(), 'Updated email configuration') }).pipe(
      catchError(this.handleError)
    );
  }

  sendTestEmail(to: string): Observable<any> {
    const params = new HttpParams().set('to', to);
    return this.http.post<any>(`${this.getBaseUrl()}/test`, {}, { 
      headers: withAudit(this.getHeaders(), 'Sent test email'),
      params: params
    }).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
    let errorMessage = 'Unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => error);
  }
}
