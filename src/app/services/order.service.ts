import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';

@Injectable({
  providedIn: 'root'
})
export class OrderService {

  jwt: any;
  host2:string= "http://localhost:8090";
  schema: string = "/orders/";

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  saveOrder(data: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.host2+this.schema, data, {headers:headers})
  }
  updateOrder(id: any, order: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.host2+this.schema+id , order, {headers:headers});
  }
  deleteOrder(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.host2+this.schema+id,{headers:headers});
  }
  getOrders() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host2 + this.schema,{headers:headers});
  }
  getTodayOrders() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host2 + this.schema + 'today',{headers:headers});
  }
  get5TopProducts() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host2 + this.schema + 'recent-top-products',{headers:headers});
  }
  getRecentOrders(){
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host2 + this.schema + 'recent-products-sold',{headers:headers});
  }

  getTotalOrderedProducts() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host2 + this.schema + 'total-ordered-products',{headers:headers});
  }

  

  updateOrderStatus(id: any, order: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.host2+this.schema+id+"/order_status" , order, {headers:headers});
  }
}
