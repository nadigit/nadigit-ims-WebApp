import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { environment } from 'src/environments/environment';
import { withAudit, auditSaveAction } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class WarehouseService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/organizations/warehouses";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';


  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  async loadToken() {
    this.jwt = await this.keycloakService.getToken();
  }

  saveWarehouse(data: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), auditSaveAction('warehouse', data, 'warehouseId', 'warehouseName'));
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, data, { headers: headers })
  }
  updateWarehouse(id: any, supplier: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Updated warehouse');
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + '/' + id, supplier, { headers: headers });
  }
  getWarehouseDeleteImpact(id: any) {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + '/' + id + '/delete-impact', { headers });
  }
  deleteWarehouse(id: any, force: boolean = false) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), force ? 'Force deleted warehouse' : 'Deleted warehouse');
    let params = new HttpParams();
    if (force) {
      params = params.set('force', 'true');
    }
    return this.http.delete(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + '/' + id, { headers: headers, params });
  }
  getWarehouses() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, { headers: headers });
  }
  getWarehouse(id: number) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + '/' + id, { headers: headers });
  }

  getProductsByWarehouse(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + '/' + id + '/products', { headers: headers });
  }
}
