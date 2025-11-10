import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api'; // Assuming you're using PrimeNG's MessageService


@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/notifications";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService, private messageService: MessageService) { }

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

  // getNotifications(): Observable<any> {
  //   this.loadToken(); // Load token before making the request
  //   const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.jwt });
  //   return this.http.get<any>(this.host2 + this.schema, { headers: headers }).pipe(
  //     catchError(this.handleError)
  //   );
  // }

  getNotifications(page: number = 0, size: number = 20): Observable<any> {
    const url = `${this.getBaseUrl()}?page=${page}&size=${size}`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // getNotifications(page: number, size: number): Observable<any> {
  //   const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.jwt });
  //   // return this.http.get<any>(`${this.host2}${this.schema}/notifications?page=${page}&size=${size}`, { headers: headers });
  //   return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/notifications?page='+page+'&size='+size,{headers:headers});
  // }

  // getRecentNotifications(page: number, size: number): Observable<any> {
  //   const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.jwt });
  //   // return this.http.get<any>(`${this.host2}${this.schema}/recent-notifications?page=${page}&size=${size}`, { headers: headers });
  //   return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/recent-notifications?page='+page+'&size='+size,{headers:headers});

  // }

  getRecentNotifications(page: number = 0, size: number = 10): Observable<any> {
    const url = `${this.getBaseUrl()}/recent?page=${page}&size=${size}`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getUnreadNotifications(page: number = 0, size: number = 20): Observable<any> {
    const url = `${this.getBaseUrl()}/unread?page=${page}&size=${size}`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getPriorityNotifications(page: number = 0, size: number = 10): Observable<any> {
    const url = `${this.getBaseUrl()}/priority?page=${page}&size=${size}`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getNotificationsByType(type: string, page: number = 0, size: number = 20): Observable<any> {
    const url = `${this.getBaseUrl()}/type/${type}?page=${page}&size=${size}`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getNotificationSummary(): Observable<any> {
    const url = `${this.getBaseUrl()}/summary`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getUnreadCount(): Observable<number> {
    const url = `${this.getBaseUrl()}/count/unread`;
    return this.http.get<number>(url, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  getNotificationCountsByType(): Observable<Map<string, number>> {
    const url = `${this.getBaseUrl()}/counts/by-type`;
    return this.http.get<Map<string, number>>(url, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  // === Notification Management Methods ===

  markAsRead(notificationId: number): Observable<void> {
    const url = `${this.getBaseUrl()}/${notificationId}/read`;
    return this.http.put<void>(url, {}, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  markAllAsRead(): Observable<void> {
    const url = `${this.getBaseUrl()}/read-all`;
    return this.http.put<void>(url, {}, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  deleteNotification(notificationId: number): Observable<void> {
    const url = `${this.getBaseUrl()}/${notificationId}`;
    return this.http.delete<void>(url, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  clearAllNotifications(): Observable<void> {
    const url = this.getBaseUrl();
    return this.http.delete<void>(url, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  muteNotificationType(type: string): Observable<void> {
    const url = `${this.getBaseUrl()}/mute/${type}`;
    return this.http.post<void>(url, {}, { headers: this.getHeaders() });
  }

  // Get user's muted types
  getMutedTypes(): Observable<string[]> {
    const url = `${this.getBaseUrl()}/muted-types`;
    return this.http.get<string[]>(url, { headers: this.getHeaders() });
  }

  // Check if a type is muted
  isTypeMuted(type: string): Observable<boolean> {
    const url = `${this.getBaseUrl()}/is-muted/${type}`;
    return this.http.get<boolean>(url, { headers: this.getHeaders() });
  }



  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(errorMessage);
  }


  showSuccess(message: string) {
    this.messageService.clear(); // Clear any existing messages
    this.messageService.add({ severity: 'success', summary: 'Success', detail: message });
  }

  showError(message: string) {
    this.messageService.clear();
    this.messageService.add({ severity: 'error', summary: 'Error', detail: message });
  }
}




