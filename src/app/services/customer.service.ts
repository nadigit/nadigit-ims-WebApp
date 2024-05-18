import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {

  jwt: any;
  host2:string= "http://localhost:8090";
  schema: string = "/customers/";
  
  

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  saveCustomer(data: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.host2+this.schema, data, {headers:headers})
  }
  updateCustomer(id: any, customer: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.host2+this.schema+id , customer, {headers:headers});
  }
  deleteCustomer(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.host2+this.schema+id,{headers:headers});
  }
  getCustomers() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host2 + this.schema,{headers:headers});
  }

}
