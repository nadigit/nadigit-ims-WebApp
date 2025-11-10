import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OrderService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/orders/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  saveOrder(data: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema, data, {headers:headers})
  }
  updateOrder(id: any, order: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id , order, {headers:headers});
  }
  deleteOrder(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id,{headers:headers});
  }
  getOrders() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema,{headers:headers});
  }
  getOrder(orderId: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + orderId,{headers:headers});
  }
  getEligibleOrdersForReturn() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + 'eligible-orders-returns',{headers:headers});
  }
  getTodayOrders() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + 'today',{headers:headers});
  }
  get5TopProducts() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + 'recent-top-products',{headers:headers});
  }
  getRecentOrders(){
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + 'recent-products-sold',{headers:headers});
  }

  getMonthlyOrders() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + 'monthly',{headers:headers});
  }

  getTotalOrderedProducts() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + 'total-ordered-products',{headers:headers});
  }

  updateOrderStatus(id: any, order: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort +this.schema+id+"/update-status" , order, {headers:headers});
  }

  processReturn(orderId: number, returnedItems: any, reason: string, notes: string | null): Observable<any> {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    // Build the query parameters
    let params = new HttpParams()
        .set('reason', reason);

    if (notes) {
        params = params.set('notes', notes);
    }
    return this.http.post<any>(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort +this.schema+orderId+"/returns" , returnedItems, {headers:headers, params: params});
  }

  getOrdersReturns(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort +this.schema+id+"/returns", {headers:headers});
  }

  getUnpaidOrdersByCustomer(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort +this.schema + "unpaid/" + id, {headers:headers});
  }

  getEligibleOrdersForDocsByType(docType: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort +this.schema + "eligible-financial-docs/" + docType, {headers:headers});
  }

}
