import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { KeycloakService } from 'keycloak-angular';
import { Bank } from '../models/bank';
import { BankAccount } from '../models/bank-account';
import { BankTransaction, AccountSummary, TransactionFilter, PageResponse } from '../models/bank-transaction';

@Injectable({
  providedIn: 'root'
})
export class BankAccountService {

  private jwt: any;
  private schema: string = "/api/bank-accounts/";
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
    return new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
  }

  private getBaseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  }

  // ==================== Banks Management ====================

  async createBank(bank: Bank): Promise<Observable<Bank>> {
    const headers = await this.getHeaders();
    return this.http.post<Bank>(`${this.getBaseUrl()}banks`, bank, { headers });
  }

  async getBanks(active?: boolean): Promise<Observable<Bank[]>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (active !== undefined) {
      params = params.set('active', active.toString());
    }
    return this.http.get<Bank[]>(`${this.getBaseUrl()}banks`, { headers, params });
  }

  async getBank(id: number): Promise<Observable<Bank>> {
    const headers = await this.getHeaders();
    return this.http.get<Bank>(`${this.getBaseUrl()}banks/${id}`, { headers });
  }

  async updateBank(id: number, bank: Bank): Promise<Observable<Bank>> {
    const headers = await this.getHeaders();
    return this.http.put<Bank>(`${this.getBaseUrl()}banks/${id}`, bank, { headers });
  }

  async deleteBank(id: number): Promise<Observable<void>> {
    const headers = await this.getHeaders();
    return this.http.delete<void>(`${this.getBaseUrl()}banks/${id}`, { headers });
  }

  // ==================== Bank Accounts Management ====================

  async createBankAccount(account: BankAccount): Promise<Observable<BankAccount>> {
    const headers = await this.getHeaders();
    return this.http.post(this.getBaseUrl(), account, { 
      headers, 
      responseType: 'text',
      observe: 'response'
    }).pipe(
      map((response: HttpResponse<string>) => {
        // Extract JSON from response body (may have extra content)
        const responseText = response.body || '';
        try {
          // Try to parse as-is first
          return JSON.parse(responseText);
        } catch (e) {
          // If that fails, try to extract the first valid JSON object
          // Find the first opening brace
          const firstBrace = responseText.indexOf('{');
          if (firstBrace === -1) {
            // No JSON found, but if status is 201, treat as success
            if (response.status === 201) {
              return {} as BankAccount;
            }
            throw e;
          }
          
          // Find the matching closing brace by counting nested braces
          let braceCount = 0;
          let lastBrace = firstBrace;
          for (let i = firstBrace; i < responseText.length; i++) {
            if (responseText[i] === '{') braceCount++;
            if (responseText[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                lastBrace = i;
                break;
              }
            }
          }
          
          if (braceCount === 0) {
            // Found matching braces, try to parse
            const jsonStr = responseText.substring(firstBrace, lastBrace + 1);
            try {
              return JSON.parse(jsonStr);
            } catch (parseError) {
              console.warn('Could not parse extracted JSON, but status is', response.status);
              // Return empty object if status is 201 (success)
              if (response.status === 201) {
                return {} as BankAccount;
              }
              throw parseError;
            }
          }
          
          // If status is 201, treat as success even if we can't parse
          if (response.status === 201) {
            return {} as BankAccount;
          }
          throw e;
        }
      }),
      catchError((error: any) => {
        // Handle case where backend returns 201 but response has JSON parsing issues
        if (error?.status === 201) {
          console.warn('Response parsing failed but status is 201 (success)');
          return new Observable(observer => {
            observer.next({} as BankAccount);
            observer.complete();
          });
        }
        return throwError(() => error);
      })
    );
  }

  async getBankAccounts(active?: boolean): Promise<Observable<BankAccount[]>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (active !== undefined) {
      params = params.set('active', active.toString());
    }
    return this.http.get<BankAccount[]>(this.getBaseUrl(), { headers, params });
  }

  async getBankAccount(id: number): Promise<Observable<BankAccount>> {
    const headers = await this.getHeaders();
    return this.http.get<BankAccount>(`${this.getBaseUrl()}${id}`, { headers });
  }

  async getAccountsByBank(bankId: number): Promise<Observable<BankAccount[]>> {
    const headers = await this.getHeaders();
    return this.http.get<BankAccount[]>(`${this.getBaseUrl()}banks/${bankId}/accounts`, { headers });
  }

  async getAccountBalance(id: number): Promise<Observable<number>> {
    const headers = await this.getHeaders();
    return this.http.get<number>(`${this.getBaseUrl()}${id}/balance`, { headers });
  }

  async recalculateBalance(id: number): Promise<Observable<void>> {
    const headers = await this.getHeaders();
    return this.http.post<void>(`${this.getBaseUrl()}${id}/recalculate-balance`, {}, { headers });
  }

  async updateBankAccount(id: number, account: BankAccount): Promise<Observable<BankAccount>> {
    const headers = await this.getHeaders();
    return this.http.put<BankAccount>(`${this.getBaseUrl()}${id}`, account, { headers });
  }

  async deleteBankAccount(id: number): Promise<Observable<void>> {
    const headers = await this.getHeaders();
    return this.http.delete<void>(`${this.getBaseUrl()}${id}`, { headers });
  }

  async getBalanceAsOfDate(id: number, asOfDate: string): Promise<Observable<number>> {
    const headers = await this.getHeaders();
    const params = new HttpParams().set('asOfDate', asOfDate);
    return this.http.get<number>(`${this.getBaseUrl()}${id}/balance-as-of`, { headers, params });
  }

  async getAccountSummary(id: number, startDate?: string, endDate?: string): Promise<Observable<AccountSummary>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    return this.http.get<AccountSummary>(`${this.getBaseUrl()}${id}/summary`, { headers, params });
  }

  // ==================== Transactions Management ====================

  async recordTransaction(accountId: number, transaction: BankTransaction): Promise<Observable<BankTransaction>> {
    const headers = await this.getHeaders();
    return this.http.post<BankTransaction>(`${this.getBaseUrl()}${accountId}/transactions`, transaction, { headers });
  }

  async getTransactions(accountId: number, filter?: TransactionFilter): Promise<Observable<PageResponse<BankTransaction>>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    
    if (filter) {
      if (filter.startDate) params = params.set('startDate', filter.startDate);
      if (filter.endDate) params = params.set('endDate', filter.endDate);
      if (filter.type) params = params.set('type', filter.type);
      if (filter.reconciled !== undefined) params = params.set('reconciled', filter.reconciled.toString());
      if (filter.page !== undefined) params = params.set('page', filter.page.toString());
      if (filter.size !== undefined) params = params.set('size', filter.size.toString());
      if (filter.sortBy) params = params.set('sortBy', filter.sortBy);
      if (filter.sortDirection) params = params.set('sortDirection', filter.sortDirection);
    }

    return this.http.get<PageResponse<BankTransaction>>(
      `${this.getBaseUrl()}${accountId}/transactions`,
      { headers, params }
    );
  }

  async reconcileTransaction(transactionId: number): Promise<Observable<void>> {
    const headers = await this.getHeaders();
    return this.http.post<void>(`${this.getBaseUrl()}transactions/${transactionId}/reconcile`, {}, { headers });
  }

  async reconcileBatch(transactionIds: number[]): Promise<Observable<void>> {
    const headers = await this.getHeaders();
    return this.http.post<void>(`${this.getBaseUrl()}transactions/reconcile-batch`, transactionIds, { headers });
  }

  async reverseTransaction(transactionId: number, reason?: string): Promise<Observable<void>> {
    const headers = await this.getHeaders();
    const body = reason ? { reason } : {};
    return this.http.post<void>(`${this.getBaseUrl()}transactions/${transactionId}/reverse`, body, { headers });
  }
}

