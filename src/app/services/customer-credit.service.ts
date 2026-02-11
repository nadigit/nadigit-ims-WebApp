import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { CustomerCreditAccount } from '../models/customer-credit-account';
import { CustomerCreditTransaction, CreditTransactionType } from '../models/customer-credit-transaction';
import { CreditInfo } from '../models/credit-info';
import { CreditCheck } from '../models/credit-check';
import { CreditAging } from '../models/credit-aging';
import { CreditStatus } from '../models/customer-credit-account';

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerCreditService {

  jwt: any;
  schema: string = "/api/customer-credits/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  private async getHeaders(): Promise<HttpHeaders> {
    if (!this.jwt) {
      await this.loadToken();
    }
    return new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
  }

  private getBaseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  }

  // Credit Account Management

  async getCreditAccount(customerId: number): Promise<Observable<CustomerCreditAccount>> {
    const headers = await this.getHeaders();
    return this.http.get<CustomerCreditAccount>(`${this.getBaseUrl()}account/customer/${customerId}`, { headers });
  }

  async getCreditAccountDetails(customerId: number): Promise<Observable<CustomerCreditAccount>> {
    const headers = await this.getHeaders();
    return this.http.get<CustomerCreditAccount>(`${this.getBaseUrl()}account/customer/${customerId}/details`, { headers });
  }

  async updateCreditAccount(accountId: number, account: Partial<CustomerCreditAccount>): Promise<Observable<CustomerCreditAccount>> {
    const headers = await this.getHeaders();
    return this.http.put<CustomerCreditAccount>(`${this.getBaseUrl()}account/${accountId}`, account, { headers });
  }

  async setCreditLimit(customerId: number, limit: number): Promise<Observable<CustomerCreditAccount>> {
    const headers = await this.getHeaders();
    const params = new HttpParams().set('creditLimit', limit.toString());
    return this.http.put<CustomerCreditAccount>(`${this.getBaseUrl()}account/customer/${customerId}/limit`, {}, { headers, params });
  }

  async setCreditTerms(customerId: number, termsDays: number | null): Promise<Observable<CustomerCreditAccount>> {
    const headers = await this.getHeaders();
    const params = new HttpParams().set('creditTermsDays', termsDays !== null ? termsDays.toString() : '');
    return this.http.put<CustomerCreditAccount>(`${this.getBaseUrl()}account/customer/${customerId}/terms`, {}, { headers, params });
  }

  async updateCreditStatus(customerId: number, status: CreditStatus): Promise<Observable<CustomerCreditAccount>> {
    const headers = await this.getHeaders();
    const params = new HttpParams().set('status', status);
    return this.http.put<CustomerCreditAccount>(`${this.getBaseUrl()}account/customer/${customerId}/status`, {}, { headers, params });
  }

  async getAllCreditAccounts(): Promise<Observable<CustomerCreditAccount[]>> {
    const headers = await this.getHeaders();
    return this.http.get<CustomerCreditAccount[]>(`${this.getBaseUrl()}accounts`, { headers });
  }

  async getActiveCreditAccounts(): Promise<Observable<CustomerCreditAccount[]>> {
    const headers = await this.getHeaders();
    return this.http.get<CustomerCreditAccount[]>(`${this.getBaseUrl()}accounts/active`, { headers });
  }

  // Credit Transactions

  async issueCredit(
    customerId: number, 
    amount: number, 
    description?: string, 
    expirationDate?: string
  ): Promise<Observable<CustomerCreditTransaction>> {
    const headers = await this.getHeaders();
    let params = new HttpParams().set('amount', amount.toString());
    if (description) {
      params = params.set('description', description);
    }
    if (expirationDate) {
      params = params.set('expirationDate', expirationDate);
    }
    return this.http.post<CustomerCreditTransaction>(`${this.getBaseUrl()}customer/${customerId}/issue`, {}, { headers, params });
  }

  async adjustCredit(
    customerId: number, 
    amount: number, 
    reason?: string, 
    notes?: string
  ): Promise<Observable<CustomerCreditTransaction>> {
    const headers = await this.getHeaders();
    let params = new HttpParams().set('amount', amount.toString());
    if (reason) {
      params = params.set('reason', reason);
    }
    if (notes) {
      params = params.set('notes', notes);
    }
    return this.http.post<CustomerCreditTransaction>(`${this.getBaseUrl()}customer/${customerId}/adjust`, {}, { headers, params });
  }

  async reverseTransaction(transactionId: number, reason?: string): Promise<Observable<CustomerCreditTransaction>> {
    const headers = await this.getHeaders();
    let params = new HttpParams();
    if (reason) {
      params = params.set('reason', reason);
    }
    return this.http.post<CustomerCreditTransaction>(`${this.getBaseUrl()}transaction/${transactionId}/reverse`, {}, { headers, params });
  }

  async getCreditTransactions(customerId: number): Promise<Observable<CustomerCreditTransaction[]>> {
    const headers = await this.getHeaders();
    return this.http.get<CustomerCreditTransaction[]>(`${this.getBaseUrl()}customer/${customerId}/transactions`, { headers });
  }

  async getCreditTransactionsPaged(
    customerId: number, 
    page: number = 0, 
    size: number = 20, 
    sort: string = 'transactionDate,desc'
  ): Promise<Observable<Page<CustomerCreditTransaction>>> {
    const headers = await this.getHeaders();
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);
    return this.http.get<Page<CustomerCreditTransaction>>(`${this.getBaseUrl()}customer/${customerId}/transactions/paged`, { headers, params });
  }

  async getCreditTransactionsByDateRange(
    customerId: number, 
    startDate: string, 
    endDate: string
  ): Promise<Observable<CustomerCreditTransaction[]>> {
    const headers = await this.getHeaders();
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get<CustomerCreditTransaction[]>(`${this.getBaseUrl()}customer/${customerId}/transactions/range`, { headers, params });
  }

  // Credit Information

  async checkCredit(customerId: number, amount: number): Promise<Observable<CreditCheck>> {
    const headers = await this.getHeaders();
    const params = new HttpParams().set('amount', amount.toString());
    return this.http.get<CreditCheck>(`${this.getBaseUrl()}customer/${customerId}/check`, { headers, params });
  }

  async getCreditInfo(customerId: number): Promise<Observable<CreditInfo>> {
    const headers = await this.getHeaders();
    return this.http.get<CreditInfo>(`${this.getBaseUrl()}customer/${customerId}/info`, { headers });
  }

  // Reports

  async getCreditAging(customerId: number): Promise<Observable<CreditAging>> {
    const headers = await this.getHeaders();
    return this.http.get<CreditAging>(`${this.getBaseUrl()}customer/${customerId}/aging`, { headers });
  }

  async getOutstandingCredit(): Promise<Observable<CustomerCreditAccount[]>> {
    const headers = await this.getHeaders();
    return this.http.get<CustomerCreditAccount[]>(`${this.getBaseUrl()}accounts/outstanding`, { headers });
  }

  async getOverLimitAccounts(): Promise<Observable<CustomerCreditAccount[]>> {
    const headers = await this.getHeaders();
    return this.http.get<CustomerCreditAccount[]>(`${this.getBaseUrl()}accounts/over-limit`, { headers });
  }

  async processExpiredCredits(): Promise<Observable<CustomerCreditTransaction[]>> {
    const headers = await this.getHeaders();
    return this.http.post<CustomerCreditTransaction[]>(`${this.getBaseUrl()}process-expired`, {}, { headers });
  }

  /**
   * Download customer follow-up report in CSV, Excel or PDF format.
   * Returns the full HTTP response (with Blob body) so caller can read Content-Disposition.
   */
  async downloadCustomerFollowupReport(
    customerId: number,
    format: 'csv' | 'excel' | 'pdf',
    includeItems: boolean
  ): Promise<Observable<any>> {
    const headers = await this.getHeaders();

    let url = `${this.getBaseUrl()}customer/${customerId}/followup-report`;
    if (format === 'excel') {
      url += '/excel';
    } else if (format === 'pdf') {
      url += '/pdf';
    }

    const params = new HttpParams().set('includeItems', includeItems ? 'true' : 'false');

    return this.http.get(url, {
      headers,
      params,
      responseType: 'blob' as 'blob',
      observe: 'response'
    });
  }
}

