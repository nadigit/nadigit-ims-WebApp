import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom } from 'rxjs';

export interface CheckoutReservationLine {
  productId: number;
  quantity: number;
}

export interface ProductStockReservationHolder {
  reservedByUsername: string;
  quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class StockReservationService {
  jwt: any;
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) {}

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  /**
   * Replace server-side soft reservations for a back-office checkout draft.
   * Empty lines removes all reservations for the context.
   */
  async syncCheckoutContext(contextId: string, lines: CheckoutReservationLine[]): Promise<void> {
    this.loadToken();
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/sales/stock-reservations/checkout-context`;
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    await firstValueFrom(this.http.put(url, { contextId, lines }, { headers }));
  }

  async listHoldersForProduct(productId: number, warehouseId?: number | null): Promise<ProductStockReservationHolder[]> {
    this.loadToken();
    let url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/sales/stock-reservations/products/${productId}`;
    if (warehouseId != null) {
      url += `?warehouseId=${encodeURIComponent(String(warehouseId))}`;
    }
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    return firstValueFrom(this.http.get<ProductStockReservationHolder[]>(url, { headers }));
  }
}
