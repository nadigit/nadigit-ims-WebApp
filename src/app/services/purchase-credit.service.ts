import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PurchaseCreditService {

  jwt: any;
  schema: string = "/api/purchase-credits/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  saveCredit(data: any) {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, data, { headers: headers });
  }

  updateCredit(id: any, credit: any) {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, credit, { headers: headers });
  }

  deleteCredit(id: any) {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.delete(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }

  getCredits(): Observable<any> {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, { headers: headers });
  }

  getCreditById(id: any): Observable<any> {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }

  getCreditsForReturn(returnId: number): Observable<any> {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'return/' + returnId, { headers: headers });
  }

  confirmCredit(id: any) {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + '/confirm', {}, { headers: headers });
  }
}

