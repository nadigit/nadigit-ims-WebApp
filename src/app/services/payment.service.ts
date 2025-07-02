import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/payments/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';  
  

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  // savePayment(orderId: number, amount: number, paymentMethod: string, paymentDate: Date) {
  //   const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
  //   const formattedDate = paymentDate.toISOString().split('T')[0]; // "2025-06-23"

  //   const params = new HttpParams()
  //     .set('orderId', orderId.toString())
  //     .set('amount', amount.toString())
  //     .set('paymentMethod', paymentMethod)
  //     .set('paymentDate', formattedDate);
  
  //   const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}process`;
  
  //   return this.http.post(url, null, { headers, params });
  // }
  savePayment(payment: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}process`;
    return this.http.post(url, payment, { headers });
}
  
  updatePayment(id: any, payment: any) {
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+ this.schema + id , payment, {headers:headers});
  }
  deletePayment(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id,{headers:headers});
  }
  getPayments() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema,{headers:headers});
  }

  getPaymentsByOrderId(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+'order/'+id,{headers:headers});
  }
}
