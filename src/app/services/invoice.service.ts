import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {

  jwt: any;
  host2:string= "http://localhost:8090";
  schema: string = "/orders/";

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  generateInvoice(orderId: number, status: string): Observable<any> {
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.jwt });
    const options = { headers: headers,};
    return this.http.get(this.host2 + this.schema + orderId + '/invoice?status='+status, { ...options, responseType: 'blob', });
}

}
