import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { withAudit, auditSaveAction } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class FinancialDocumentsService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/financial-documents/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';


  constructor(private http: HttpClient, public keycloakService: KeycloakService,) { }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  saveFinancialDoc(data: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), auditSaveAction('financial document', data, 'financialDocId', 'documentNumber'));
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, data, { headers: headers, params: { origin: 'BACK_OFFICE' } })
  }

  updateFinancialDoc(id: any, financialDoc: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Updated financial document');
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, financialDoc, { headers: headers });
  }

  issueFinancialDoc(id: any, financialDoc: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Issued financial document');
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + '/issue', financialDoc, { headers: headers });
  }

  deleteFinancialDoc(id: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Deleted financial document');
    return this.http.delete(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }

  getFinancialDocs() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, { headers: headers });
  }

  getFinancialDocsByOrder(orderId: number) {
    this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'order/' + orderId,
      { headers }
    );
  }

  getFinancialDocsPaginated(
    page: number,
    size: number,
    globalFilter: string = '',
    sortBy: string = 'createdAt',
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
          case 'docType':
            backendParamName = 'docType';
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
          case 'docStatus':
            backendParamName = 'docStatus';
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
          case 'origin':
            backendParamName = 'origin';
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
          case 'orderId':
            backendParamName = 'orderId';
            if (value && typeof value === 'object' && value.orderId) {
              value = String(value.orderId);
            } else if (value && typeof value === 'object' && value.id) {
              value = String(value.id);
            }
            break;
          case 'documentDateFrom':
            backendParamName = 'fromDate';
            value = this.formatDateForBackend(value);
            break;
          case 'documentDateTo':
            backendParamName = 'toDate';
            value = this.formatDateForBackend(value);
            break;
          case 'documentDate':
            backendParamName = 'documentDate';
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

  getFinancialDoc(id: any) {
    this.loadToken();
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }

  cancelFinancialDoc(docId: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Cancelled financial document');
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + docId + '/cancel', { headers: headers })
  }

  fetchFinancialDocPdf(docNumber: string) {
    this.loadToken();
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/files/${docNumber}.pdf`;
    const headers = new HttpHeaders({
      Authorization: 'Bearer ' + this.jwt
    });
    return this.http.get(url, { headers, responseType: 'blob' });
  }

  printFinancialDoc(docNumber: any) {
    this.fetchFinancialDocPdf(docNumber).subscribe({
      next: (blob) => this.openPdfBlobInPrintWindow(blob),
      error: (error) => console.error('Error downloading file:', error)
    });
  }

  /** Opens PDF in a new tab and triggers the browser print dialog. */
  openPdfBlobInPrintWindow(blob: Blob): void {
    const blobUrl = window.URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.focus();
        printWindow.print();
      }, { once: true });
    }
  }

  /**
   * Payment voucher for an outgoing payment — our record that we paid a supplier.
   *
   * The counterpart of a receipt, which is issued by whoever receives money. Origin is BACK_OFFICE
   * because a supplier payment is never taken at a till.
   */
  generatePaymentVoucher(paymentId: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Generated payment voucher');
    return this.http.post(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'voucher/payment/' + paymentId + '/create',
      {},
      { headers: headers, params: { origin: 'BACK_OFFICE' } }
    );
  }

  generateReceiptFromPOS(paymentId: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Generated POS receipt');
    return this.http.post(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'receipt/payment/' + paymentId + '/create',
      {},
      { headers: headers, params: { origin: 'POS' } }
    );
  }

  generateInvoiceFromOrder(orderId: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Generated invoice from order');
    return this.http.post(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'invoice/order/' + orderId + '/create',
      {},
      { headers: headers, params: { origin: 'BACK_OFFICE' } }
    );
  }

  generateReturnNoteFromReturn(returnId: any, options?: { origin?: string }) {
    this.loadToken();
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Generated return note');
    return this.http.post(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'return-note/return/' + returnId + '/create',
      {},
      { headers: headers, params: { origin: options?.origin || 'BACK_OFFICE' } }
    );
  }

  generateCreditNoteFromReturn(returnId: any, options?: { origin?: string }) {
    this.loadToken();
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Generated credit note');
    return this.http.post(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'credit-note/return/' + returnId + '/create',
      {},
      { headers: headers, params: { origin: options?.origin || 'BACK_OFFICE' } }
    );
  }

  generateProformaInvoiceFromOrder(orderId: any, options?: { origin?: string; documentDate?: Date | string }) {
    this.loadToken();
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Generated proforma invoice');
    
    let params: any = { origin: options?.origin || 'BACK_OFFICE' };
    
    if (options?.documentDate) {
      const dateStr = options.documentDate instanceof Date 
        ? options.documentDate.toISOString().split('T')[0]
        : options.documentDate;
      params.documentDate = dateStr;
    }
    
    return this.http.post(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'proforma-invoice/order/' + orderId + '/create',
      {},
      { headers: headers, params: params }
    );
  }

  generatePurchaseOrderFromOrder(orderId: any, options?: { origin?: string; documentDate?: Date | string }) {
    this.loadToken();
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Generated purchase order');
    
    let params: any = { origin: options?.origin || 'BACK_OFFICE' };
    
    if (options?.documentDate) {
      const dateStr = options.documentDate instanceof Date 
        ? options.documentDate.toISOString().split('T')[0]
        : options.documentDate;
      params.documentDate = dateStr;
    }
    
    return this.http.post(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'purchase-order/order/' + orderId + '/create',
      {},
      { headers: headers, params: params }
    );
  }

  generateDeliveryOrderFromOrder(orderId: any, options?: { origin?: string; documentDate?: Date | string }) {
    this.loadToken();
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Generated delivery note');
    
    let params: any = { origin: options?.origin || 'BACK_OFFICE' };
    
    if (options?.documentDate) {
      const dateStr = options.documentDate instanceof Date 
        ? options.documentDate.toISOString().split('T')[0]
        : options.documentDate;
      params.documentDate = dateStr;
    }
    
    return this.http.post(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'delivery-note/order/' + orderId + '/create',
      {},
      { headers: headers, params: params }
    );
  }

  generateQuoteFromOrder(orderId: any, options?: { origin?: string; documentDate?: Date | string }) {
    this.loadToken();
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Generated quote');
    
    let params: any = { origin: options?.origin || 'BACK_OFFICE' };
    
    if (options?.documentDate) {
      const dateStr = options.documentDate instanceof Date 
        ? options.documentDate.toISOString().split('T')[0]
        : options.documentDate;
      params.documentDate = dateStr;
    }
    
    return this.http.post(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'quote/order/' + orderId + '/create',
      {},
      { headers: headers, params: params }
    );
  }

  /**
   * Get HTML preview of a financial document
   * @param documentData The financial document data to preview
   * @returns Observable with PreviewResponse containing html property
   */
  getDocumentPreview(documentData: any): any {
    this.loadToken();
    let headers = new HttpHeaders({ 
      'authorization': 'Bearer ' + this.jwt,
      'Content-Type': 'application/json'
    });
    
    return this.http.post<{ html: string }>(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'preview',
      documentData,
      { 
        headers: headers
      }
    );
  }
}
