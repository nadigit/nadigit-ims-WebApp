import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PurchaseCreditService {

  jwt: any;
  schema: string = "/api/purchase-credits/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  saveCredit(data: any) {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, data, { headers: headers });
  }

  updateCredit(id: any, credit: any) {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, credit, { headers: headers });
  }

  deleteCredit(id: any) {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.delete(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }

  getCredits(): Observable<any> {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, { headers: headers });
  }

  getCreditById(id: any): Observable<any> {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }

  getCreditsForReturn(returnId: number): Observable<any> {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'return/' + returnId, { headers: headers });
  }

  confirmCredit(id: any) {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + '/confirm', {}, { headers: headers });
  }

  getCreditsPaginated(
    page: number,
    size: number,
    globalFilter: string = '',
    sortBy: string = 'creditDate',
    direction: string = 'DESC',
    filters?: { [field: string]: any }
  ): Observable<any> {
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });

    let url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;

    // Global filter
    if (globalFilter) {
      url += `&search=${encodeURIComponent(globalFilter)}`;
    }

    // Process column filters - map PrimeNG field names to backend parameter names
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
          return;  // Skip empty values
        }

        let value = filterMeta.value;
        let backendParamName = field;

        // Map PrimeNG field names to backend parameter names
        switch (field) {
          case 'status':
            backendParamName = 'status';
            // Extract value if it's an object (dropdown might pass full object)
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

          case 'creditMethod':
            backendParamName = 'creditMethod';
            // Extract value if it's an object (dropdown might pass full object)
            if (value && typeof value === 'object' && value.value) {
              value = value.value;
            } else if (value && typeof value === 'object' && value.label) {
              value = value.label;
            }
            // Map old values to new enum values for backward compatibility
            const creditMethodMap: { [key: string]: string } = {
              'Cash': 'CASH',
              'Card': 'CARD',
              'Check': 'CHECK',
              'Transfer': 'BANK_TRANSFER',
              'BOE': 'BOE',
              'Boe': 'BOE'
            };
            if (value && creditMethodMap[value]) {
              value = creditMethodMap[value];
            }
            break;

          case 'supplierId':
            backendParamName = 'supplierId';
            // Extract supplierId from the supplier object and convert to string
            if (value && typeof value === 'object' && value.supplierId) {
              value = String(value.supplierId);
            } else if (value && typeof value === 'object' && value.id) {
              value = String(value.id);
            } else if (typeof value === 'number') {
              value = String(value);
            }
            break;

          case 'creditDateFrom':
          case 'fromDate':
            backendParamName = 'fromDate';
            value = this.formatDateForBackend(value);
            break;

          case 'creditDateTo':
          case 'toDate':
            backendParamName = 'toDate';
            value = this.formatDateForBackend(value);
            break;

          case 'creditDate':
            // BACKWARD COMPATIBILITY: Keep support for single date
            backendParamName = 'creditDate';
            value = this.formatDateForBackend(value);
            break;

          default:
            // For any other fields, use as-is
            break;
        }

        // Skip empty values after processing
        if (value == null || value === '') {
          return;
        }

        const encodedValue = encodeURIComponent(value);
        url += `&${encodeURIComponent(backendParamName)}=${encodedValue}`;
      });
    }

    return this.http.get(url, { headers });
  }

  // Helper method for consistent date formatting
  private formatDateForBackend(date: any): string {
    if (!date) return '';

    if (date instanceof Date) {
      // Use local date components to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else if (typeof date === 'string') {
      // If it's already a string, try to parse and format it
      try {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          // Use local date components to avoid timezone issues
          const year = parsedDate.getFullYear();
          const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
          const day = String(parsedDate.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      } catch (e) {
        // If parsing fails, check if it's already in yyyy-MM-dd format
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (isoDateRegex.test(date)) {
          return date; // Already in correct format
        }
        console.warn('Date value is not in expected format:', date);
        return date; // Return as-is
      }
    }

    return String(date);
  }
}

