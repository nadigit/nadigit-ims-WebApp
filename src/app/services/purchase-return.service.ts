import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { withAudit, auditSaveAction } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class PurchaseReturnService {

  jwt: any;
  schema: string = "/api/purchase-returns/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  saveReturn(data: any) {
    this.loadToken();
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), auditSaveAction('purchase return', data, 'returnId', 'reference'));
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, data, { headers: headers });
  }

  updateReturn(id: any, purchaseReturn: any) {
    this.loadToken();
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Updated purchase return');
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, purchaseReturn, { headers: headers });
  }

  deleteReturn(id: any) {
    this.loadToken();
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Deleted purchase return');
    return this.http.delete(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }

  getReturns(): Observable<any> {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, { headers: headers });
  }

  /**
   * Paginated purchase returns with filtering and search.
   * Matches backend signature:
   * page, size, sortBy, direction, search, returnStatus, refundStatus,
   * supplierId, shopName, returnDate, fromDate, toDate
   */
  getReturnsPaginated(
    page: number,
    size: number,
    globalFilter: string = '',
    sortBy: string = 'returnDate',
    direction: string = 'DESC',
    filters?: { [field: string]: any }
  ): Observable<any> {
    this.loadToken();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });

    let url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;

    // Global search
    if (globalFilter) {
      url += `&search=${encodeURIComponent(globalFilter)}`;
    }

    // Normalize PrimeNG filter meta
    const normalizeFilter = (filter: any) => {
      if (!filter) {
        return null;
      }
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
          case 'returnStatus':
            backendParamName = 'returnStatus';
            // dropdowns may pass object or primitive
            if (value && typeof value === 'object') {
              if (value.value !== undefined && value.value !== null) {
                value = value.value;
              } else if (value.label !== undefined && value.label !== null) {
                value = value.label;
              } else {
                value = String(value);
              }
            }
            if (value !== null && value !== undefined) {
              value = String(value).trim();
            }
            break;

          case 'refundStatus':
            backendParamName = 'refundStatus';
            if (value && typeof value === 'object') {
              if (value.value !== undefined && value.value !== null) {
                value = value.value;
              } else if (value.label !== undefined && value.label !== null) {
                value = value.label;
              } else {
                value = String(value);
              }
            }
            if (value !== null && value !== undefined) {
              value = String(value).trim();
            }
            break;

          case 'supplierId':
            backendParamName = 'supplierId';
            // Accept supplier object or id
            if (value && typeof value === 'object' && (value.supplierId || value.id)) {
              value = String(value.supplierId || value.id);
            } else if (typeof value === 'number') {
              value = String(value);
            }
            break;

          case 'shopName':
          case 'purchase.shop.name':
            backendParamName = 'shopName';
            if (value && typeof value === 'object' && value.name) {
              value = value.name;
            }
            break;

          case 'returnDate':
            backendParamName = 'returnDate';
            value = this.formatDateForBackend(value);
            break;

          case 'returnDateFrom':
          case 'fromDate':
            backendParamName = 'fromDate';
            value = this.formatDateForBackend(value);
            break;

          case 'returnDateTo':
          case 'toDate':
            backendParamName = 'toDate';
            value = this.formatDateForBackend(value);
            break;

          default:
            // use as-is
            break;
        }

        if (value == null || value === '') {
          return;
        }

        const encodedValue = encodeURIComponent(value);
        url += `&${encodeURIComponent(backendParamName)}=${encodedValue}`;
      });
    }

    return this.http.get(url, { headers });
  }

  getReturnById(id: any): Observable<any> {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }

  getReturnsForPurchase(purchaseId: number): Observable<any> {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'purchase/' + purchaseId, { headers: headers });
  }

  getReturnsReadyForCredit(): Observable<any> {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'ready-for-credit', { headers: headers });
  }

  cancelReturn(id: any) {
    this.loadToken();
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Cancelled purchase return');
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + '/cancel', {}, { headers: headers });
  }

  // Helper for consistent date formatting (yyyy-MM-dd) - returns only date part, no time
  private formatDateForBackend(date: any): string {
    if (!date) return '';

    // If already a properly formatted date string (YYYY-MM-DD), return as-is
    if (typeof date === 'string') {
      const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateOnlyRegex.test(date)) {
        return date; // Already in correct format
      }
      
      // Handle ISO date strings (YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ss.sssZ)
      // Extract just the date part before the 'T'
      const isoDateMatch = date.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoDateMatch && isoDateMatch[1]) {
        return isoDateMatch[1]; // Extract just the date part (YYYY-MM-DD)
      }
    }

    // Convert to Date object if needed
    let dateObj: Date | null = null;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      try {
        dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
          return '';
        }
      } catch {
        return '';
      }
    } else {
      return '';
    }

    // Extract only date components (no time) - use local date methods
    // This preserves the user's selected date regardless of timezone
    if (dateObj) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return '';
  }
}

