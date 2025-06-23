import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ShopService {
  jwt: string | undefined;
  // host2:string= environment.apiUrl;
  schema: string = '/organizations/shops';
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) {}

  // Ensure that the token is loaded before calling the backend
  async loadToken(): Promise<void> {
    this.jwt = await this.keycloakService.getToken();
  }

  // Example for saving a shop, the same approach applies to other methods
  saveShop(data: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema, data, { headers });
  }

  updateShop(id: any, supplier: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/' + id, supplier, { headers });
  }

  deleteShop(id: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.delete(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/' + id, { headers });
  }

  getShops() {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema, { headers });
  }

  getShop(id:number) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/' + id, { headers });
  }

  fetchOrganizationData(id: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/' + id + '/organization', { headers });
  }
  
  fetchExpenseStats(id: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/' + id + '/expenses/stats', { headers });
  }

  fetchPurchaseStats(id: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/' + id + '/purchases/stats', { headers });
  }

  fetchRecentExpenses(id: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/' + id + '/expenses/recent', { headers });
  }

  fetchRecentPurchases(id: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/' + id + '/purchases/recent', { headers });
  }

  fetchCashRegisterData(id: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/' + id + '/daily-balance', { headers });
  }

  getCashRegister(shopId: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/' + shopId + '/cash-register', { headers });
  }

  updateCashRegister(shopId: any, cashRegister: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + '/' + shopId + '/cash-register', cashRegister, { headers });
  }

}
