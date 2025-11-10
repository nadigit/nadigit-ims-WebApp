import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { BehaviorSubject, from, Observable, switchMap } from 'rxjs';
import { CashRegisterSession } from '../models/cashRegisterSession';
import { CashMovement } from '../models/cashMovement';
import { CashCollection } from '../models/cashCollection';

@Injectable({
  providedIn: 'root'
})
export class CashRegisterService {

  private jwt: string | null = null;
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
    if (!this.jwt) {
      this.jwt = await this.keycloakService.getToken();
    }
    return this.jwt;
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
    const headers = await this.getAuthHeaders();

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
    const headers = await this.getAuthHeaders();

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

  /**
   * Clear cached token (for logout or token refresh)
   */
  clearToken(): void {
    this.jwt = null;
  }

  getSessionsByShop(shopId: number): Observable<CashRegisterSession[]> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers =>
        this.http.get<CashRegisterSession[]>(
          `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}shops/${shopId}/sessions`,
          { headers }
        )
      )
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
      )
    );
  }
  getCollectionsByShop(shopId: number): Observable<CashCollection[]> {
    return from(this.getAuthHeaders()).pipe(
      switchMap(headers =>
        this.http.get<CashCollection[]>(
          `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}shops/${shopId}/collections`,
          { headers }
        )
      )
    );
  }

  async addCollection(shopId: number, amount: number, notes?: string): Promise<Observable<CashCollection>> {
    const headers = await this.getAuthHeaders();

    const params = new HttpParams()
      .set('amount', amount.toString())
      .set('notes', notes || '');

    return this.http.post<CashCollection>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}shops/${shopId}/collection`,
      null,
      { headers, params }
    );
  }

  async depositMoney(registerId: number, data: any) {
    const headers = await this.getAuthHeaders();
    return this.http.post(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}${registerId}/deposit`, data, { headers}
    );
  }


}