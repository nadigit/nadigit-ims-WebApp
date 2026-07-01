import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { BehaviorSubject, from, Observable, switchMap, timeout, catchError, of } from 'rxjs';
import { CashRegisterSession } from '../models/cashRegisterSession';
import { CashMovement } from '../models/cashMovement';
import { CashCollection } from '../models/cashCollection';
import { withAudit } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class CashRegisterService {

  private schema = '/api/cash-registers/';
  private apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  private apiHost: string = (window as any).__env.apiHost || 'localhost';
  private apiPort: string = (window as any).__env.apiPort || '8090';

  private currentSessionSubject = new BehaviorSubject<CashRegisterSession | null>(null);
  currentSession$ = this.currentSessionSubject.asObservable();

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService
  ) { }

  /**
   * Ensures JWT token is loaded before making any request
   */
  private async ensureTokenLoaded(): Promise<string> {
    const isLoggedIn = await this.keycloakService.isLoggedIn();

    if (!isLoggedIn) {
      // Force the user back to login; this throws to stop the original request
      // Use current href to preserve the /webconsole path
      await this.keycloakService.login({ redirectUri: window.location.href });
      throw new Error('User not authenticated');
    }

    try {
      // Refresh token if it is close to expiring (within the next 30s)
      await this.keycloakService.updateToken(30);
    } catch (refreshError) {
      console.error('Failed to refresh Keycloak token, redirecting to login', refreshError);
      // Use current href to preserve the /webconsole path
      await this.keycloakService.login({ redirectUri: window.location.href });
      throw refreshError;
    }

    return await this.keycloakService.getToken();
  }

  private async getAuthHeaders(): Promise<HttpHeaders> {
    const token = await this.ensureTokenLoaded();
    return new HttpHeaders({ 'Authorization': 'Bearer ' + token });
  }

  /**
   * Get the current active cash register session (if any)
   */
  async getCurrentSession(): Promise<Observable<CashRegisterSession | null>> {
    const headers = await this.getAuthHeaders();
    return this.http.get<CashRegisterSession | null>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}current`,
      { headers }
    );
  }

  async getCurrentSessionByShop(shopId: number) {
    const headers = await this.getAuthHeaders();
    return this.http.get<CashRegisterSession | null>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}shops/${shopId}/current-session`,
      { headers }
    );
  }

  /**
   * Open a new cash register session with an opening amount
   */
  async openSession(shopId: number, openingAmount: number, notes?: string): Promise<Observable<CashRegisterSession>> {
    const headers = withAudit(await this.getAuthHeaders(), 'Opened cash register session');

    const params = new HttpParams()
      .set('openingAmount', openingAmount.toString())
      .set('notes', notes ?? '');

    return this.http.post<CashRegisterSession>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}open/${shopId}`,
      null,
      { headers, params }
    );
  }

  // async openSession(shopId: number, openingAmount: number, notes?: string) {
  //   const headers = await this.getAuthHeaders();
  //   return this.http.post<CashRegisterSession>(
  //     `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}open/${shopId}`,
  //     { openingAmount, notes },
  //     { headers }
  //   );
  // }

  // async closeSession(sessionId: number, closingAmount: number, notes?: string) {
  //   const headers = await this.getAuthHeaders();
  //   return this.http.post<CashRegisterSession>(
  //     `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}close/${sessionId}`,
  //     { closingAmount, notes },
  //     { headers }
  //   );
  // }


  async closeSession(sessionId: number, declaredClosingAmount: number, notes?: string): Promise<Observable<CashRegisterSession>> {
    const headers = withAudit(await this.getAuthHeaders(), 'Closed cash register session');

    const params = new HttpParams()
      .set('declaredClosingAmount', declaredClosingAmount.toString())
      .set('notes', notes ?? '');

    return this.http.post<CashRegisterSession>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}close/${sessionId}`,
      null,
      { headers, params }
    );
  }

  /**
   * Store the current session in memory (for real-time use across components)
   */
  setCurrentSession(session: CashRegisterSession | null): void {
    this.currentSessionSubject.next(session);
  }

  getSessionsByShop(shopId: number): Observable<CashRegisterSession[]> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers =>
        this.http.get<CashRegisterSession[]>(
          `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}shops/${shopId}/sessions`,
          { headers }
        )
      ),
      timeout(8000), // Add timeout to the HTTP request
      catchError(error => {
        console.error('Error loading sessions:', error);
        return of([]); // Return empty array on error
      })
    );
  }

  getMovementsBySession(sessionId: number): Observable<CashMovement[]> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers =>
        this.http.get<CashMovement[]>(
          `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}sessions/${sessionId}/movements`,
          { headers }
        )
      )
    );
  }
  getMovementsByShop(shopId: number): Observable<CashMovement[]> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers =>
        this.http.get<CashMovement[]>(
          `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}shops/${shopId}/movements`,
          { headers }
        )
      ),
      timeout(8000), // Add timeout to the HTTP request
      catchError(error => {
        console.error('Error loading movements:', error);
        return of([]); // Return empty array on error
      })
    );
  }
  getCollectionsByShop(shopId: number): Observable<CashCollection[]> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers =>
        this.http.get<CashCollection[]>(
          `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}shops/${shopId}/collections`,
          { headers }
        )
      ),
      timeout(8000), // Add timeout to the HTTP request
      catchError(error => {
        console.error('Error loading collections:', error);
        return of([]); // Return empty array on error
      })
    );
  }

  async addCollection(
    shopId: number,
    amount: number,
    notes?: string,
    destination?: 'BANK' | 'OWNER' | 'SUPPLIER' | 'OTHER',
    bankAccountId?: number | null,
  ): Promise<Observable<CashCollection>> {
    const headers = withAudit(await this.getAuthHeaders(), 'Added cash collection');

    let params = new HttpParams()
      .set('amount', amount.toString())
      .set('notes', notes || '');
    if (destination) {
      params = params.set('destination', destination);
    }
    if (bankAccountId != null) {
      params = params.set('bankAccountId', bankAccountId.toString());
    }

    return this.http.post<CashCollection>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}shops/${shopId}/collection`,
      null,
      { headers, params }
    );
  }

  async depositMoney(registerId: number, data: any) {
    const headers = withAudit(await this.getAuthHeaders(), 'Deposited money to register');
    return this.http.post(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}${registerId}/deposit`, data, { headers}
    );
  }

  async withdrawMoney(registerId: number, data: any) {
    const headers = withAudit(await this.getAuthHeaders(), 'Withdrew money from register');
    return this.http.post(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}${registerId}/withdraw`, data, { headers}
    );
  }

  /** Move cash between a shop's register and a bank account (PRO feature). */
  async transferCashBank(shopId: number, payload: {
    direction: 'REGISTER_TO_BANK' | 'BANK_TO_REGISTER';
    bankAccountId: number;
    amount: number;
    notes?: string;
  }) {
    const headers = withAudit(await this.getAuthHeaders(), 'Cash/bank transfer');
    return this.http.post(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/treasury/shops/${shopId}/cash-bank-transfers`,
      payload,
      { headers }
    );
  }

  async downloadZReportPdf(sessionId: number, format: 'standard' | 'thermal' = 'standard') {
    const headers = await this.getAuthHeaders();
    let params = new HttpParams();
    if (format === 'thermal') {
      params = params.set('format', 'thermal');
    }
    return this.http.get(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}sessions/${sessionId}/z-report/pdf`,
      { headers, params, responseType: 'blob' as 'blob', observe: 'response' }
    );
  }

  async downloadXReportPdf(sessionId: number, format: 'standard' | 'thermal' = 'standard') {
    const headers = await this.getAuthHeaders();
    let params = new HttpParams();
    if (format === 'thermal') {
      params = params.set('format', 'thermal');
    }
    return this.http.get(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}sessions/${sessionId}/x-report/pdf`,
      { headers, params, responseType: 'blob' as 'blob', observe: 'response' }
    );
  }
}