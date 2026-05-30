import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, catchError, throwError } from 'rxjs';
import { ActionRemindersResponse } from '../models/action-reminder';

@Injectable({
  providedIn: 'root'
})
export class ActionReminderService {
  jwt: any;
  schema: string = '/api/admin/action-reminders';
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(
    private http: HttpClient,
    public keycloakService: KeycloakService
  ) {}

  private getBaseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  }

  private loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  private getHeaders(): HttpHeaders {
    this.loadToken();
    return new HttpHeaders({
      'Authorization': 'Bearer ' + this.jwt,
      'Content-Type': 'application/json'
    });
  }

  getAdminActionReminders(): Observable<ActionRemindersResponse> {
    return this.http.get<ActionRemindersResponse>(this.getBaseUrl(), {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
    const errorMessage = `Error Code: ${error?.status}\nMessage: ${error?.message || 'Unknown error'}`;
    console.error(errorMessage);
    return throwError(() => errorMessage);
  }
}
