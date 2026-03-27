import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, catchError, throwError } from 'rxjs';
import { NotificationPreferences } from '../models/notification-preferences';

@Injectable({
  providedIn: 'root'
})
export class NotificationPreferencesService {
  jwt: any;
  schema: string = '/api/notifications/preferences';
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

  getPreferences(): Observable<NotificationPreferences> {
    return this.http.get<NotificationPreferences>(this.getBaseUrl(), { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  updatePreferences(preferences: NotificationPreferences): Observable<NotificationPreferences> {
    return this.http.put<NotificationPreferences>(this.getBaseUrl(), preferences, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  muteType(type: string): Observable<void> {
    const baseUrl = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/notifications`;
    return this.http.post<void>(`${baseUrl}/mute/${type}`, {}, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  muteTypes(types: string[]): Observable<void> {
    const baseUrl = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/notifications`;
    return this.http.post<void>(`${baseUrl}/mute-types`, { types }, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  unmuteAll(): Observable<void> {
    const baseUrl = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/notifications`;
    return this.http.post<void>(`${baseUrl}/unmute-all`, {}, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getMutedTypes(): Observable<string[]> {
    const baseUrl = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/notifications`;
    return this.http.get<string[]>(`${baseUrl}/muted-types`, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  isMuted(type: string): Observable<boolean> {
    const baseUrl = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/notifications`;
    return this.http.get<boolean>(`${baseUrl}/is-muted/${type}`, { headers: this.getHeaders() }).pipe(
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
