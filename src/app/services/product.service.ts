import { Injectable } from '@angular/core';
import { AuthenticationService } from './authentication.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/stock/products/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  saveProduct(data: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema, data, {headers:headers})
  }
  updateProduct(id: any, product: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id , product, {headers:headers});
  }
  deleteProduct(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id,{headers:headers});
  }
  getProducts() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema,{headers:headers});
  }
  deactivateProduct(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema + id + '/deactivate', {headers:headers})
  }
  getInactiveProducts() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + 'inactive',{headers:headers});
  }
  reactivateProduct(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema + id + '/reactivate', {headers:headers});
  }
  getProductsOfLastWeek() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + 'lastWeek',{headers:headers});
  }
  printLabel(product: any, type: string) {
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}${product.productId}/label?labelType=${type}`;
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    this.http.get(url, { headers: headers, responseType: 'blob' }).subscribe(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    });
  }


}
