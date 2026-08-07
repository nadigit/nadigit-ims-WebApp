import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  POSSessionDTO,
  POSProductDTO,
  POSCartDTO,
  POSCheckoutDTO,
  POSReceiptDTO,
  PageResponse
} from '../models/pos';
import { withAudit } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class PosService {

  private jwt: any;
  private schema: string = '/api/pos/';
  private apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  private apiHost: string = (window as any).__env.apiHost || 'localhost';
  private apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService
  ) { }

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

  // =============== Session Management ===============

  async startSession(shopId?: number, cashRegisterSessionId?: number): Promise<Observable<POSSessionDTO>> {
    const headers = withAudit(await this.getHeaders(), 'Started POS session');
    let params = new HttpParams();
    if (shopId !== undefined && shopId !== null) {
      params = params.set('shopId', shopId.toString());
    }
    if (cashRegisterSessionId !== undefined && cashRegisterSessionId !== null) {
      params = params.set('cashRegisterSessionId', cashRegisterSessionId.toString());
    }
    return this.http.post<POSSessionDTO>(`${this.getBaseUrl()}sessions/start`, {}, { headers, params });
  }

  async getActiveSession(shopId?: number): Promise<Observable<POSSessionDTO>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (shopId !== undefined && shopId !== null) {
      params = params.set('shopId', shopId.toString());
    }
    return this.http.get<POSSessionDTO>(`${this.getBaseUrl()}sessions/active`, { headers, params });
  }

  async endSession(sessionId: number): Promise<Observable<void>> {
    const headers = withAudit(await this.getHeaders(), 'Ended POS session');
    return this.http.post<void>(`${this.getBaseUrl()}sessions/${sessionId}/end`, {}, { headers });
  }

  /** ADMIN only — paginated POS session history for back-office / shop details. */
  async getSessionHistory(shopId: number, page: number = 0, size: number = 20): Promise<Observable<PageResponse<POSSessionDTO>>> {
    const headers = await this.getHeaders();
    const params = new HttpParams()
      .set('shopId', shopId.toString())
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<POSSessionDTO>>(`${this.getBaseUrl()}sessions/history`, { headers, params });
  }

  // =============== Product Search ===============

  async searchProducts(query: string | null, shopId?: number, page: number = 0, size: number = 20): Promise<Observable<PageResponse<POSProductDTO>>> {
    const headers = await this.getHeaders();
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (shopId !== undefined && shopId !== null) {
      params = params.set('shopId', shopId.toString());
    }
    if (query && query.trim().length > 0) {
      params = params.set('query', query.trim());
    }

    return this.http.get<PageResponse<POSProductDTO>>(`${this.getBaseUrl()}products/search`, { headers, params });
  }

  async getProductByBarcode(barcode: string, shopId?: number): Promise<Observable<POSProductDTO>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (shopId !== undefined && shopId !== null) {
      params = params.set('shopId', shopId.toString());
    }
    return this.http.get<POSProductDTO>(`${this.getBaseUrl()}products/barcode/${encodeURIComponent(barcode)}`, { headers, params });
  }

  async getProductByReference(reference: string, shopId?: number): Promise<Observable<POSProductDTO>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (shopId !== undefined && shopId !== null) {
      params = params.set('shopId', shopId.toString());
    }
    return this.http.get<POSProductDTO>(`${this.getBaseUrl()}products/reference/${encodeURIComponent(reference)}`, { headers, params });
  }

  async getQuickProducts(shopId?: number, warehouseId?: number): Promise<Observable<POSProductDTO[]>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (shopId !== undefined && shopId !== null) {
      params = params.set('shopId', shopId.toString());
    }
    if (warehouseId !== undefined && warehouseId !== null) {
      params = params.set('warehouseId', warehouseId.toString());
    }
    return this.http.get<POSProductDTO[]>(`${this.getBaseUrl()}products/quick`, { headers, params });
  }

  // =============== Cart Management ===============

  async createCart(sessionId: number, customerId?: number): Promise<Observable<POSCartDTO>> {
    const headers = withAudit(await this.getHeaders(), 'Created POS cart');
    let params = new HttpParams().set('sessionId', sessionId.toString());
    if (customerId !== undefined) {
      params = params.set('customerId', customerId.toString());
    }
    return this.http.post<POSCartDTO>(`${this.getBaseUrl()}carts`, {}, { headers, params });
  }

  async getCart(cartId: number): Promise<Observable<POSCartDTO>> {
    const headers = await this.getHeaders();
    return this.http.get<POSCartDTO>(`${this.getBaseUrl()}carts/${cartId}`, { headers });
  }

  async getActiveCart(sessionId: number): Promise<Observable<POSCartDTO>> {
    const headers = await this.getHeaders();
    const params = new HttpParams().set('sessionId', sessionId.toString());
    return this.http.get<POSCartDTO>(`${this.getBaseUrl()}carts/active`, { headers, params });
  }

  async addItemToCart(cartId: number, productId: number, quantity: number, priceOverride?: number, selectedOptionIds?: string): Promise<Observable<POSCartDTO>> {
    const headers = await this.getHeaders();
    let params = new HttpParams()
      .set('productId', productId.toString())
      .set('quantity', quantity.toString());

    if (priceOverride !== undefined) {
      params = params.set('priceOverride', priceOverride.toString());
    }
    if (selectedOptionIds !== undefined) {
      params = params.set('selectedOptionIds', selectedOptionIds);
    }

    return this.http.post<POSCartDTO>(`${this.getBaseUrl()}carts/${cartId}/items`, {}, { headers, params }).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.error?.code === 'insufficient_stock') {
          const friendlyMessage = this.parseStockError(
            error.error.message || error.error.error || ''
          );
          return throwError(() => ({
            ...error,
            userFriendlyMessage: friendlyMessage
          }));
        }
        return throwError(() => error);
      })
    );
  }

  async updateCartItem(cartItemId: number, quantity?: number, priceOverride?: number, selectedOptionIds?: string, portionFraction?: number): Promise<Observable<POSCartDTO>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();

    if (quantity !== undefined) {
      params = params.set('quantity', quantity.toString());
    }
    if (priceOverride !== undefined) {
      params = params.set('priceOverride', priceOverride.toString());
    }
    if (selectedOptionIds !== undefined) {
      params = params.set('selectedOptionIds', selectedOptionIds);
    }
    if (portionFraction !== undefined) {
      params = params.set('portionFraction', portionFraction.toString());
    }

    return this.http.put<POSCartDTO>(`${this.getBaseUrl()}carts/items/${cartItemId}`, {}, { headers, params }).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.error?.code === 'insufficient_stock') {
          const friendlyMessage = this.parseStockError(
            error.error.message || error.error.error || ''
          );
          return throwError(() => ({
            ...error,
            userFriendlyMessage: friendlyMessage
          }));
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Parse stock error message for friendlier display (backend may use net vs gross wording).
   */
  private parseStockError(errorMessage: string): string {
    if (!errorMessage) return '';

    const sellableMatch = errorMessage.match(
      /Sellable quantity \(excluding (\d+) units on approved write-offs\): (\d+)/i
    );
    if (sellableMatch) {
      const writeOffs = sellableMatch[1];
      const sellable = sellableMatch[2];
      return `Insufficient stock. Only ${sellable} units available (${writeOffs} units on approved write-offs).`;
    }

    const netQtyMatch = errorMessage.match(/Net available quantity \(excluding (\d+) write-offs\): (\d+)/);
    if (netQtyMatch) {
      const writeOffs = netQtyMatch[1];
      const netAvailable = netQtyMatch[2];
      return `Insufficient stock. Only ${netAvailable} units available (${writeOffs} units written off).`;
    }

    const availableSimple = errorMessage.match(/Insufficient stock\. Available:\s*(\d+)/i);
    if (availableSimple) {
      return `Insufficient stock. Only ${availableSimple[1]} units available.`;
    }

    const simpleMatch = errorMessage.match(/Net available quantity[:\s]+(\d+)/);
    if (simpleMatch) {
      return `Insufficient stock. Only ${simpleMatch[1]} units available.`;
    }

    return errorMessage;
  }

  async removeCartItem(cartItemId: number): Promise<Observable<POSCartDTO>> {
    const headers = await this.getHeaders();
    return this.http.delete<POSCartDTO>(`${this.getBaseUrl()}carts/items/${cartItemId}`, { headers });
  }

  async updateCartDiscount(cartId: number, discountAmount?: number, discountType?: 'Amount' | 'Percentage'): Promise<Observable<POSCartDTO>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();

    if (discountAmount !== undefined) {
      params = params.set('discountAmount', discountAmount.toString());
    }
    if (discountType) {
      params = params.set('discountType', discountType);
    }

    return this.http.put<POSCartDTO>(`${this.getBaseUrl()}carts/${cartId}/discount`, {}, { headers, params });
  }

  async toggleTax(cartId: number, taxEnabled: boolean): Promise<Observable<POSCartDTO>> {
    const headers = await this.getHeaders();
    const params = new HttpParams().set('taxEnabled', taxEnabled.toString());
    return this.http.put<POSCartDTO>(`${this.getBaseUrl()}carts/${cartId}/tax`, {}, { headers, params });
  }

  async updateCartTransport(cartId: number, transportAmount: number): Promise<Observable<POSCartDTO>> {
    const headers = await this.getHeaders();
    const params = new HttpParams().set('transportAmount', transportAmount.toString());
    return this.http.put<POSCartDTO>(`${this.getBaseUrl()}carts/${cartId}/transport`, {}, { headers, params });
  }

  async updateCartAdditionalCharges(cartId: number, additionalChargesAmount: number): Promise<Observable<POSCartDTO>> {
    const headers = await this.getHeaders();
    const params = new HttpParams().set('additionalChargesAmount', additionalChargesAmount.toString());
    return this.http.put<POSCartDTO>(`${this.getBaseUrl()}carts/${cartId}/additional-charges`, {}, { headers, params });
  }

  async setCustomer(cartId: number, customerId?: number): Promise<Observable<POSCartDTO>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (customerId !== undefined) {
      params = params.set('customerId', customerId.toString());
    }
    return this.http.put<POSCartDTO>(`${this.getBaseUrl()}carts/${cartId}/customer`, {}, { headers, params });
  }

  async holdCart(cartId: number): Promise<Observable<POSCartDTO>> {
    const headers = withAudit(await this.getHeaders(), 'Held POS cart');
    return this.http.post<POSCartDTO>(`${this.getBaseUrl()}carts/${cartId}/hold`, {}, { headers });
  }

  async getHoldCarts(shopId?: number): Promise<Observable<POSCartDTO[]>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (shopId !== undefined && shopId !== null) {
      params = params.set('shopId', shopId.toString());
    }
    return this.http.get<POSCartDTO[]>(`${this.getBaseUrl()}carts/hold`, { headers, params });
  }

  async resumeCart(cartId: number): Promise<Observable<POSCartDTO>> {
    const headers = withAudit(await this.getHeaders(), 'Resumed POS cart');
    return this.http.post<POSCartDTO>(`${this.getBaseUrl()}carts/${cartId}/resume`, {}, { headers });
  }

  async cancelCart(cartId: number): Promise<Observable<void>> {
    const headers = withAudit(await this.getHeaders(), 'Cancelled POS cart');
    return this.http.post<void>(`${this.getBaseUrl()}carts/${cartId}/cancel`, {}, { headers });
  }

  // =============== Checkout ===============

  async checkout(cartId: number, checkoutDto: POSCheckoutDTO): Promise<Observable<POSReceiptDTO>> {
    const headers = withAudit(await this.getHeaders(), 'Completed POS checkout');
    return this.http.post<POSReceiptDTO>(`${this.getBaseUrl()}carts/${cartId}/checkout`, checkoutDto, {
      headers
    });
  }

  // =============== Reports ===============

  async getTodaySales(shopId?: number): Promise<Observable<POSCartDTO[]>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (shopId !== undefined && shopId !== null) {
      params = params.set('shopId', shopId.toString());
    }
    return this.http.get<POSCartDTO[]>(`${this.getBaseUrl()}reports/today-sales`, { headers, params });
  }

  async getTodayTotal(shopId?: number): Promise<Observable<number>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (shopId !== undefined && shopId !== null) {
      params = params.set('shopId', shopId.toString());
    }
    return this.http.get<number>(`${this.getBaseUrl()}reports/today-total`, { headers, params });
  }

  async getTodayCount(shopId?: number): Promise<Observable<number>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (shopId !== undefined && shopId !== null) {
      params = params.set('shopId', shopId.toString());
    }
    return this.http.get<number>(`${this.getBaseUrl()}reports/today-count`, { headers, params });
  }
}


