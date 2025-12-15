import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';
import { Observable, firstValueFrom } from 'rxjs';
import { WarehouseTransfer, PagedTransferResponse } from '../models/warehouseTransfer';

@Injectable({
  providedIn: 'root'
})
export class WarehouseTransferService {
  jwt: any;
  schema: string = "/api/warehouse-transfers";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(
    private http: HttpClient,
    public keycloakService: KeycloakService
  ) { }

  private async ensureTokenLoaded(): Promise<void> {
    if (!this.jwt) {
      this.jwt = await this.keycloakService.getToken();
    }
  }

  async createTransfer(transfer: WarehouseTransfer): Promise<Observable<WarehouseTransfer>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
    return this.http.post<WarehouseTransfer>(url, transfer, { headers });
  }

  async initiateTransfer(id: number): Promise<Observable<WarehouseTransfer>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/${id}/initiate`;
    return this.http.post<WarehouseTransfer>(url, {}, { headers });
  }

  async completeTransfer(id: number): Promise<Observable<WarehouseTransfer>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/${id}/complete`;
    return this.http.post<WarehouseTransfer>(url, {}, { headers });
  }

  async cancelTransfer(id: number): Promise<Observable<WarehouseTransfer>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/${id}/cancel`;
    return this.http.post<WarehouseTransfer>(url, {}, { headers });
  }

  async getTransfer(id: number): Promise<Observable<WarehouseTransfer>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/${id}`;
    return this.http.get<WarehouseTransfer>(url, { headers });
  }

  async getTransferByReference(reference: string): Promise<Observable<WarehouseTransfer>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/by-reference/${reference}`;
    return this.http.get<WarehouseTransfer>(url, { headers });
  }

  async searchTransfers(
    page: number = 0,
    size: number = 20,
    sourceWarehouseId?: number,
    destinationWarehouseId?: number,
    status?: string,
    startDate?: string,
    endDate?: string,
    sortBy: string = 'creationDate',
    sortDirection: string = 'DESC'
  ): Promise<Observable<PagedTransferResponse>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDirection', sortDirection);

    if (sourceWarehouseId != null) {
      params = params.set('sourceWarehouseId', sourceWarehouseId.toString());
    }
    if (destinationWarehouseId != null) {
      params = params.set('destinationWarehouseId', destinationWarehouseId.toString());
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
    return this.http.get<PagedTransferResponse>(url, { headers, params });
  }

  async getTransfersBySourceWarehouse(
    warehouseId: number,
    page: number = 0,
    size: number = 20
  ): Promise<Observable<PagedTransferResponse>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/source/${warehouseId}`;
    return this.http.get<PagedTransferResponse>(url, { headers, params });
  }

  async getTransfersByDestinationWarehouse(
    warehouseId: number,
    page: number = 0,
    size: number = 20
  ): Promise<Observable<PagedTransferResponse>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/destination/${warehouseId}`;
    return this.http.get<PagedTransferResponse>(url, { headers, params });
  }

  async getTransfersByStatus(
    status: string,
    page: number = 0,
    size: number = 20
  ): Promise<Observable<PagedTransferResponse>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/status/${status}`;
    return this.http.get<PagedTransferResponse>(url, { headers, params });
  }
}

