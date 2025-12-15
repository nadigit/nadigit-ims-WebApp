import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { StockMovement, PagedStockMovementResponse } from '../models/stockMovement';

@Injectable({
  providedIn: 'root'
})
export class StockMovementService {
  jwt: any;
  schema: string = "/api/stock-movements";
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

  async getStockMovements(
    page: number = 0,
    size: number = 20,
    productId?: number,
    warehouseId?: number,
    start?: string,
    end?: string
  ): Promise<Observable<PagedStockMovementResponse>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (productId != null) {
      params = params.set('productId', productId.toString());
    }
    if (warehouseId != null) {
      params = params.set('warehouseId', warehouseId.toString());
    }
    if (start && start.trim() !== '') {
      params = params.set('start', start);
    }
    if (end && end.trim() !== '') {
      params = params.set('end', end);
    }

    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
    return this.http.get<PagedStockMovementResponse>(url, { headers, params });
  }

  async getStockMovement(id: number): Promise<Observable<StockMovement>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/${id}`;
    return this.http.get<StockMovement>(url, { headers });
  }

  async getMovementsByProduct(
    productId: number,
    page: number = 0,
    size: number = 20
  ): Promise<Observable<PagedStockMovementResponse>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/product/${productId}`;
    return this.http.get<PagedStockMovementResponse>(url, { headers, params });
  }

  async getMovementsByWarehouse(
    warehouseId: number,
    page: number = 0,
    size: number = 20
  ): Promise<Observable<PagedStockMovementResponse>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/warehouse/${warehouseId}`;
    return this.http.get<PagedStockMovementResponse>(url, { headers, params });
  }

  async getMovementsByType(
    movementType: string,
    page: number = 0,
    size: number = 20
  ): Promise<Observable<PagedStockMovementResponse>> {
    await this.ensureTokenLoaded();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/type/${movementType}`;
    return this.http.get<PagedStockMovementResponse>(url, { headers, params });
  }
}

