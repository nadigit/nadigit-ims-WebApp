import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { withAudit, auditSaveAction } from '../utils/audit-action';
import { Expense, ExpenseConfig } from '../models/expense';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/expenses/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';  
  

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  saveExpense(data: any) {
    let headers=withAudit(new HttpHeaders({'authorization':'Bearer '+this.jwt}), auditSaveAction('expense', data, 'id', 'reference'));
    return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema, data, {headers:headers})
  }
  updateExpense(id: any, data: any) {
    let headers=withAudit(new HttpHeaders({'authorization':'Bearer '+this.jwt}), 'Updated expense');
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id , data, {headers:headers});
  }
  deleteExpense(id: any) {
    let headers=withAudit(new HttpHeaders({'authorization':'Bearer '+this.jwt}), 'Deleted expense');
    return this.http.delete(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id,{headers:headers});
  }
  getExpenses() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema,{headers:headers});
  }

  getExpensesPaginated(
    page: number,
    size: number,
    globalFilter: string = '',
    sortBy: string = 'dateOfExpense',
    direction: string = 'DESC',
    filters?: { [field: string]: any }
  ): Observable<any> {
    this.loadToken(); // Ensure token is loaded
    let url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;

    if (globalFilter) {
      url += `&search=${encodeURIComponent(globalFilter)}`;
    }

    const normalizeFilter = (filter: any) => {
      if (!filter) return null;
      if (Array.isArray(filter)) {
        return filter.find(meta => meta && meta.value !== undefined && meta.value !== null && meta.value !== '');
      }
      return filter;
    };

    if (filters) {
      Object.keys(filters).forEach(field => {
        const filterMeta = normalizeFilter(filters[field]);
        if (!filterMeta || filterMeta.value == null || filterMeta.value === '') {
          return;
        }

        let value = filterMeta.value;
        let backendParamName = field;

        switch (field) {
          case 'paymentMethod':
            backendParamName = 'paymentMethod';
            if (value && typeof value === 'object') {
              if (value.value !== undefined && value.value !== null) {
                value = value.value;
              } else if (value.label !== undefined && value.label !== null) {
                value = value.label;
              } else {
                value = String(value);
              }
            }
            // Map old values to new enum values if needed
            if (value !== null && value !== undefined) {
              value = String(value).trim();
            }
            break;
          case 'shopId':
            backendParamName = 'shopId';
            if (value && typeof value === 'object' && value.shopId) {
              value = String(value.shopId);
            } else if (value && typeof value === 'object' && value.id) {
              value = String(value.id);
            }
            break;
          case 'shopName':
            backendParamName = 'shopName';
            if (value && typeof value === 'object' && value.shopName) {
              value = value.shopName;
            } else if (value && typeof value === 'object' && value.name) {
              value = value.name;
            }
            break;
          case 'dateOfExpenseFrom':
            backendParamName = 'fromDate';
            value = this.formatDateForBackend(value);
            break;
          case 'dateOfExpenseTo':
            backendParamName = 'toDate';
            value = this.formatDateForBackend(value);
            break;
          case 'dateOfExpense':
            backendParamName = 'expenseDate';
            value = this.formatDateForBackend(value);
            break;
          default:
            break;
        }

        if (value == null || value === '') {
          return;
        }
        url += `&${encodeURIComponent(backendParamName)}=${encodeURIComponent(value)}`;
      });
    }
    return this.http.get(url, { headers: new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }) });
  }

  private formatDateForBackend(date: any): string {
    if (!date) return '';
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else if (typeof date === 'string') {
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (isoDateRegex.test(date)) {
        return date;
      }
      try {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          const year = parsedDate.getFullYear();
          const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
          const day = String(parsedDate.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      } catch (e) {
        console.warn('Date value is not in expected format:', date);
      }
    }
    return '';
  }
  getExpense(id: any) {
    this.loadToken(); // Ensure token is loaded before making the request
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }

  getExpenseConfig(): Observable<ExpenseConfig> {
    this.loadToken();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}config`;
    return this.http.get<ExpenseConfig>(url, { headers });
  }

  approveExpense(id: number): Observable<unknown> {
    this.loadToken();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}${id}/approve`;
    return this.http.post(url, {}, { headers });
  }

  rejectExpense(id: number, reason?: string): Observable<unknown> {
    this.loadToken();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    let params = new HttpParams();
    if (reason != null && reason !== '') {
      params = params.set('reason', reason);
    }
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}${id}/reject`;
    return this.http.post(url, {}, { headers, params });
  }

  uploadExpenseAttachment(expenseId: number, file: File): Observable<unknown> {
    this.loadToken();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    const formData = new FormData();
    formData.append('file', file, file.name);
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}${expenseId}/attachments`;
    return this.http.post(url, formData, { headers });
  }

  deleteExpenseAttachment(expenseId: number, attachmentId: number): Observable<unknown> {
    this.loadToken();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}${expenseId}/attachments/${attachmentId}`;
    return this.http.delete(url, { headers });
  }
  getMonthlyOrders() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + 'monthly',{headers:headers});
  }
}

/** Omit server-managed / read-only fields from expense create/update JSON bodies. */
export function buildExpenseWritePayload(expense: Partial<Expense>): Record<string, unknown> {
  const raw = { ...(expense as Record<string, unknown>) };
  const omit = [
    'attachments', 'status', 'approvedBy', 'approvedDate', 'approvalDate',
    'rejectedBy', 'rejectedDate', 'rejectionReason', 'createdBy', 'submissionDate',
    'reimbursementDate', 'reimbursedBy', 'approvalNotes', 'lastUpdated'
  ];
  omit.forEach((k) => delete raw[k]);
  return raw;
}
