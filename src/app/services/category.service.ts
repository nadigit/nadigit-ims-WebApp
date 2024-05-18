import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  jwt: any;
  host2:string= "http://localhost:8090";
  schema: string = "/stock/categories/";
  
  constructor(private http: HttpClient, public keycloakService: KeycloakService,) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  saveCategory(data: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.host2+this.schema, data, {headers:headers})
  }
  updateCategory(id: any, category: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.host2+this.schema+id , category, {headers:headers});
  }
  deleteCategory(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.host2+this.schema+id,{headers:headers});
  }
  getCategories() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.host2 + this.schema,{headers:headers});
  }
}
