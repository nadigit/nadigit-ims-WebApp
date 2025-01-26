import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/orders/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  generateInvoice(orderId: number, status: string): Observable<any> {
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.jwt });
    const options = { headers: headers,};
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + orderId + '/invoice?status='+status, { ...options, responseType: 'blob', });
}

}
