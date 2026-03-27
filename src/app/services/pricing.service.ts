import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { CustomerPriceOverrideDTO, PriceListDTO, PriceListItemDTO } from '../models/pricing';
import { withAudit } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class PricingService {
  private jwt: any;
  private schema: string = '/api/pricing';
  private apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  private apiHost: string = (window as any).__env.apiHost || 'localhost';
  private apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, private keycloakService: KeycloakService) {}

  private async ensureTokenLoaded(): Promise<void> {
    if (!this.jwt) {
      this.jwt = await this.keycloakService.getToken();
    }
  }

  private async getHeaders(): Promise<HttpHeaders> {
    await this.ensureTokenLoaded();
    return new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
  }

  private getBaseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  }

  async getPriceLists(): Promise<Observable<PriceListDTO[]>> {
    const headers = await this.getHeaders();
    return this.http.get<PriceListDTO[]>(`${this.getBaseUrl()}/price-lists`, { headers });
  }

  async createPriceList(payload: PriceListDTO): Promise<Observable<PriceListDTO>> {
    const headers = withAudit(await this.getHeaders(), 'Created price list');
    return this.http.post<PriceListDTO>(`${this.getBaseUrl()}/price-lists`, payload, { headers });
  }

  async updatePriceList(id: number, payload: PriceListDTO): Promise<Observable<PriceListDTO>> {
    const headers = withAudit(await this.getHeaders(), 'Updated price list');
    return this.http.put<PriceListDTO>(`${this.getBaseUrl()}/price-lists/${id}`, payload, { headers });
  }

  async getPriceListItems(priceListId: number): Promise<Observable<PriceListItemDTO[]>> {
    const headers = await this.getHeaders();
    return this.http.get<PriceListItemDTO[]>(`${this.getBaseUrl()}/price-lists/${priceListId}/items`, { headers });
  }

  async createPriceListItem(priceListId: number, payload: PriceListItemDTO): Promise<Observable<PriceListItemDTO>> {
    const headers = withAudit(await this.getHeaders(), 'Added item to price list');
    return this.http.post<PriceListItemDTO>(`${this.getBaseUrl()}/price-lists/${priceListId}/items`, payload, { headers });
  }

  async updatePriceListItem(itemId: number, payload: PriceListItemDTO): Promise<Observable<PriceListItemDTO>> {
    const headers = withAudit(await this.getHeaders(), 'Updated price list item');
    return this.http.put<PriceListItemDTO>(`${this.getBaseUrl()}/price-list-items/${itemId}`, payload, { headers });
  }

  async deletePriceListItem(itemId: number): Promise<Observable<void>> {
    const headers = withAudit(await this.getHeaders(), 'Removed item from price list');
    return this.http.delete<void>(`${this.getBaseUrl()}/price-list-items/${itemId}`, { headers });
  }

  async assignCustomerPriceList(customerId: number, priceListId: number): Promise<Observable<void>> {
    const headers = withAudit(await this.getHeaders(), 'Assigned price list to customer');
    return this.http.post<void>(`${this.getBaseUrl()}/customers/${customerId}/price-list/${priceListId}`, {}, { headers });
  }

  async clearCustomerPriceList(customerId: number): Promise<Observable<void>> {
    const headers = withAudit(await this.getHeaders(), 'Cleared customer price list');
    return this.http.post<void>(`${this.getBaseUrl()}/customers/${customerId}/price-list/clear`, {}, { headers });
  }

  async getCustomerOverrides(customerId: number): Promise<Observable<CustomerPriceOverrideDTO[]>> {
    const headers = await this.getHeaders();
    return this.http.get<CustomerPriceOverrideDTO[]>(`${this.getBaseUrl()}/customers/${customerId}/overrides`, { headers });
  }

  async upsertCustomerOverride(
    customerId: number,
    payload: CustomerPriceOverrideDTO
  ): Promise<Observable<CustomerPriceOverrideDTO>> {
    const headers = withAudit(await this.getHeaders(), 'Updated customer price override');
    return this.http.post<CustomerPriceOverrideDTO>(`${this.getBaseUrl()}/customers/${customerId}/overrides`, payload, { headers });
  }

  async deactivateCustomerOverride(customerId: number, overrideId: number): Promise<Observable<void>> {
    const headers = withAudit(await this.getHeaders(), 'Deactivated customer price override');
    return this.http.post<void>(`${this.getBaseUrl()}/customers/${customerId}/overrides/${overrideId}/deactivate`, {}, { headers });
  }
}
