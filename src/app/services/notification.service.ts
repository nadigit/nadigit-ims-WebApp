import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, catchError, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  jwt: any;
  host2: string = "http://localhost:8090";
  schema: string = "/api";

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

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
    return this.http.get<any>(`${this.host2}${this.schema}/notifications?page=${page}&size=${size}`, { headers: headers });
  }

  getRecentNotifications(page: number, size: number): Observable<any> {
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.jwt });
    return this.http.get<any>(`${this.host2}${this.schema}/recent-notifications?page=${page}&size=${size}`, { headers: headers });
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
}




