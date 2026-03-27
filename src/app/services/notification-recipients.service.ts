import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, catchError, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationRecipientsService {
  jwt: any;
  schema: string = '/api/email/config/notification-recipients';
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

  getRecipients(): Observable<{ recipients: string[] }> {
    return this.http.get<{ recipients: string[] }>(this.getBaseUrl(), { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  setRecipients(recipients: string[]): Observable<{ recipients: string[] }> {
    return this.http.put<{ recipients: string[] }>(this.getBaseUrl(), { recipients }, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  addRecipient(email: string): Observable<any> {
    const params = new HttpParams().set('email', email);
    return this.http.post<any>(this.getBaseUrl(), {}, { 
      headers: this.getHeaders(),
      params: params
    }).pipe(
      catchError(this.handleError)
    );
  }

  removeRecipient(email: string): Observable<any> {
    const params = new HttpParams().set('email', email);
    return this.http.delete<any>(this.getBaseUrl(), { 
      headers: this.getHeaders(),
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
