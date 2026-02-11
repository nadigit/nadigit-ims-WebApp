import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RefundService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/refunds/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';  
  

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken(){
    this.jwt = this.keycloakService.getToken();
  }

  // saveRefund(refund: any) {
  //   const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
  
  //   const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  
  //   return this.http.post(url, null, { headers });
  // }

  saveRefund(refund: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.post(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema , refund, {headers:headers});
  }
  
  updateRefund(id: any, refund: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.put(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id , refund, {headers:headers});
  }
  deleteRefund(id: any) {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.delete(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort+this.schema+id,{headers:headers});
  }
  getRefunds() {
    let headers=new HttpHeaders({'authorization':'Bearer '+this.jwt})
    return this.http.get(this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema,{headers:headers});
  }

  getRefundsPaginated(
    page: number,
    size: number,
    globalFilter: string = '',
    sortBy: string = 'refundDate',
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
          case 'refundMethod':
            backendParamName = 'refundMethod';
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
              // Map old values to new enum values
              switch (value) {
                case 'Cash': value = 'CASH'; break;
                case 'Card': value = 'CARD'; break;
                case 'Check': value = 'CHECK'; break;
                case 'Transfer': value = 'TRANSFER'; break;
                case 'BOE': value = 'BOE'; break;
              }
            }
            break;
          case 'status':
            backendParamName = 'status';
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
          case 'customerId':
            backendParamName = 'customerId';
            if (value && typeof value === 'object' && value.customerId) {
              value = String(value.customerId);
            } else if (value && typeof value === 'object' && value.id) {
              value = String(value.id);
            }
            break;
          case 'returnId':
            backendParamName = 'returnId';
            if (value && typeof value === 'object' && value.returnId) {
              value = String(value.returnId);
            } else if (value && typeof value === 'object' && value.id) {
              value = String(value.id);
            }
            break;
          case 'refundDateFrom':
            backendParamName = 'fromDate';
            value = this.formatDateForBackend(value);
            break;
          case 'refundDateTo':
            backendParamName = 'toDate';
            value = this.formatDateForBackend(value);
            break;
          case 'refundDate':
            backendParamName = 'refundDate';
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
  getRefund(id: any) {
    this.loadToken(); // Ensure token is loaded before making the request
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }

  confirmRefund(id: any) {
    this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + '/confirm', {}, { headers: headers });
  }
}
