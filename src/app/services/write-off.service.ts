import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';
import { Observable, firstValueFrom } from 'rxjs';
import { InventoryWriteOff, PagedWriteOffResponse, CreateWriteOffRequest } from '../models/write-off';

@Injectable({
  providedIn: 'root'
})
export class WriteOffService {
  jwt: any;
  schema: string = "/api/inventory-write-offs";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(
    private http: HttpClient,
    public keycloakService: KeycloakService
  ) { }

  async loadToken(): Promise<void> {
    if (!this.jwt) {
      this.jwt = await this.keycloakService.getToken();
    }
  }

  private async ensureTokenLoaded(): Promise<void> {
    if (!this.jwt) {
      this.jwt = await this.keycloakService.getToken();
    }
  }

  async searchWriteOffs(
    page: number = 0,
    size: number = 20,
    productId?: number,
    warehouseId?: number,
    condition?: string,
    sourceType?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
    sortBy: string = 'writeOffDate',
    sortDirection: string = 'DESC'
  ): Promise<Observable<PagedWriteOffResponse>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDirection', sortDirection);

    if (productId != null) {
      params = params.set('productId', productId.toString());
    }
    if (warehouseId != null) {
      params = params.set('warehouseId', warehouseId.toString());
    }
    if (condition) {
      params = params.set('condition', condition);
    }
    if (sourceType) {
      params = params.set('sourceType', sourceType);
    }
    if (status) {
      params = params.set('status', status);
    }
    if (startDate && startDate.trim() !== '') {
      params = params.set('startDate', startDate);
    }
    if (endDate && endDate.trim() !== '') {
      params = params.set('endDate', endDate);
    }

    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
    return this.http.get<PagedWriteOffResponse>(url, { headers, params });
  }

  async getWriteOff(id: number): Promise<Observable<InventoryWriteOff>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/${id}`;
    return this.http.get<InventoryWriteOff>(url, { headers });
  }

  async getWriteOffByReference(reference: string): Promise<Observable<InventoryWriteOff>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/by-reference/${reference}`;
    return this.http.get<InventoryWriteOff>(url, { headers });
  }

  async getPendingWriteOffs(): Promise<Observable<InventoryWriteOff[]>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/pending`;
    return this.http.get<InventoryWriteOff[]>(url, { headers });
  }

  async getWriteOffsByProduct(productId: number): Promise<Observable<InventoryWriteOff[]>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/product/${productId}`;
    return this.http.get<InventoryWriteOff[]>(url, { headers });
  }

  async getWriteOffsByWarehouse(warehouseId: number): Promise<Observable<InventoryWriteOff[]>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/warehouse/${warehouseId}`;
    return this.http.get<InventoryWriteOff[]>(url, { headers });
  }

  async getWriteOffsByCondition(condition: string): Promise<Observable<InventoryWriteOff[]>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/condition/${condition}`;
    return this.http.get<InventoryWriteOff[]>(url, { headers });
  }

  async getWriteOffsBySourceType(sourceType: string): Promise<Observable<InventoryWriteOff[]>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/source-type/${sourceType}`;
    return this.http.get<InventoryWriteOff[]>(url, { headers });
  }

  async getWriteOffsBySource(sourceType: string, sourceId: number): Promise<Observable<InventoryWriteOff[]>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('sourceType', sourceType)
      .set('sourceId', sourceId.toString());
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/by-source`;
    return this.http.get<InventoryWriteOff[]>(url, { headers, params });
  }

  async createWriteOff(request: CreateWriteOffRequest): Promise<Observable<InventoryWriteOff>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt, 'Content-Type': 'application/json' });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
    return this.http.post<InventoryWriteOff>(url, request, { headers });
  }

  async approveWriteOff(id: number): Promise<Observable<InventoryWriteOff>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/${id}/approve`;
    return this.http.post<InventoryWriteOff>(url, {}, { headers });
  }

  async rejectWriteOff(id: number, reason?: string): Promise<Observable<InventoryWriteOff>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams();
    if (reason) {
      params = params.set('reason', reason);
    }
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/${id}/reject`;
    return this.http.post<InventoryWriteOff>(url, {}, { headers, params });
  }

  async getTotalCost(startDate?: string, endDate?: string): Promise<Observable<number>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams();
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/summary/total-cost`;
    return this.http.get<number>(url, { headers, params });
  }

  async getSummaryByCondition(startDate?: string, endDate?: string): Promise<Observable<any>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams();
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/summary/by-condition`;
    return this.http.get<any>(url, { headers, params });
  }

  async getSummaryBySourceType(startDate?: string, endDate?: string): Promise<Observable<any>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams();
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/summary/by-source-type`;
    return this.http.get<any>(url, { headers, params });
  }

  async getStatistics(startDate?: string, endDate?: string): Promise<Observable<any>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams();
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/statistics`;
    return this.http.get<any>(url, { headers, params });
  }
}

