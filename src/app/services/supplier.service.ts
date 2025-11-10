import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupplierService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/suppliers/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';


  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  saveSupplier(data: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, data, { headers: headers })
  }
  updateSupplier(id: any, supplier: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, supplier, { headers: headers });
  }
  deleteSupplier(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.delete(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }
  getSuppliers() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, { headers: headers });
  }

  getPurchasesBySupplier(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + '/purchases', { headers: headers });

  }

  // getProductsBySupplier(id:any){
  //   let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
  //   return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema +id+ '/products',{headers:headers});
  // }

  getProductsBySupplier(id: any): Observable<any[]> {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get<any[]>(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + '/products', { headers: headers });
  }

  getSuppliersWithUnpaidPurchases() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'unpaid-purchases', { headers: headers });
  }
}
