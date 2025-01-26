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
  schema: string = "/api";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService,private messageService: MessageService) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  // getNotifications(): Observable<any> {
  //   this.loadToken(); // Load token before making the request
  //   const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.jwt });
  //   return this.http.get<any>(this.host2 + this.schema, { headers: headers }).pipe(
  //     catchError(this.handleError)
  //   );
  // }

  getNotifications(page: number, size: number): Observable<any> {
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.jwt });
    // return this.http.get<any>(`${this.host2}${this.schema}/notifications?page=${page}&size=${size}`, { headers: headers });
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/notifications?page='+page+'&size='+size,{headers:headers});
  }

  getRecentNotifications(page: number, size: number): Observable<any> {
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.jwt });
    // return this.http.get<any>(`${this.host2}${this.schema}/recent-notifications?page=${page}&size=${size}`, { headers: headers });
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/recent-notifications?page='+page+'&size='+size,{headers:headers});

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




