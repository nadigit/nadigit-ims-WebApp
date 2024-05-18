import { Injectable } from '@angular/core';
import { AuthenticationService } from './authentication.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  jwt: any;
  host2:string= "http://localhost:8090";
  schema: string = "/stock/products/";

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  saveProduct(data: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.host2+this.schema, data, {headers:headers})
  }
  updateProduct(id: any, customer: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.host2+this.schema+id , customer, {headers:headers});
  }
  deleteProduct(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.host2+this.schema+id,{headers:headers});
  }
  getProducts() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host2 + this.schema,{headers:headers});
  }

}
