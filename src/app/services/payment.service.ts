import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { Payment } from 'src/app/models/payment';
import { environment } from 'src/environments/environment';
import { withAudit, auditSaveAction } from '../utils/audit-action';

/** Mirrors the backend PaymentAttachmentDTO. */
export interface PaymentAttachment {
  id: number;
  paymentId: number;
  originalName: string;
  contentType?: string;
  sizeBytes?: number;
  uploadedBy?: string;
  uploadedAt?: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/payments/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';


  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  // --- Proof of payment -------------------------------------------------------------------
  // The document the other party gave us: their receipt, a cheque image, a transfer advice.
  // Distinct from the payment voucher, which is the document we issue.

  private attachmentsUrl(paymentId: number | string): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}${paymentId}/attachments`;
  }

  private authHeaders(): HttpHeaders {
    if (!this.jwt) {
      this.loadToken();
    }
    return new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
  }

  listPaymentAttachments(paymentId: number | string) {
    return this.http.get<PaymentAttachment[]>(this.attachmentsUrl(paymentId), { headers: this.authHeaders() });
  }

  uploadPaymentAttachment(paymentId: number | string, file: File, notes?: string) {
    const form = new FormData();
    form.append('file', file);
    if (notes) {
      form.append('notes', notes);
    }
    // Content-Type is deliberately unset: the browser must add the multipart boundary itself.
    return this.http.post<PaymentAttachment>(this.attachmentsUrl(paymentId), form, { headers: this.authHeaders() });
  }

  /**
   * Fetched as a blob through the API rather than linked directly, so the file stays behind the
   * same authorization as the payment.
   */
  downloadPaymentAttachment(paymentId: number | string, attachmentId: number) {
    return this.http.get(`${this.attachmentsUrl(paymentId)}/${attachmentId}/content`,
      { headers: this.authHeaders(), responseType: 'blob' });
  }

  deletePaymentAttachment(paymentId: number | string, attachmentId: number) {
    return this.http.delete(`${this.attachmentsUrl(paymentId)}/${attachmentId}`, { headers: this.authHeaders() });
  }

  // savePayment(orderId: number, amount: number, paymentMethod: string, paymentDate: Date) {
  //   const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
  //   const formattedDate = paymentDate.toISOString().split('T')[0]; // "2025-06-23"

  //   const params = new HttpParams()
  //     .set('orderId', orderId.toString())
  //     .set('amount', amount.toString())
  //     .set('paymentMethod', paymentMethod)
  //     .set('paymentDate', formattedDate);

  //   const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}process`;

  //   return this.http.post(url, null, { headers, params });
  // }
  savePayment(payment: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), auditSaveAction('payment', payment, 'paymentId', 'reference'));
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}process`;
    return this.http.post(url, payment, { headers });
  }

  updatePayment(id: any, payment: any) {
    const headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Updated payment');
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, payment, { headers: headers });
  }

  confirmPayment(id: any) {
    const headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Confirmed payment');
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + '/confirm', { headers: headers });
  }

  deletePayment(id: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Deleted payment');
    return this.http.delete(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }
  getPayment(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }

  getPayments(
    context: 'incoming' | 'outgoing', 
    page: number, 
    size: number, 
    filter: string = '', 
    sortBy: string = 'paymentDate', 
    direction: string = 'DESC',
    filters?: { [field: string]: any }
  ) {
    this.loadToken();
    const headers = new HttpHeaders({ authorization: 'Bearer ' + this.jwt });

    // Choose endpoint based on direction
    const endpoint = context === 'incoming' ? 'incoming-payments' : 'outgoing-payments';

    // Build full URL
    let url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}${endpoint}?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;

    // Global search
    if (filter) {
      url += `&search=${encodeURIComponent(filter)}`;
    }

    // Process filter parameters
    if (filters) {
      Object.keys(filters).forEach(field => {
        const filterMeta = filters[field];
        if (!filterMeta || filterMeta.value == null || filterMeta.value === '') {
          return;
        }

        let value = filterMeta.value;
        let backendParamName = field;

        switch (field) {
          case 'paymentStatus':
          case 'status':
            backendParamName = 'paymentStatus';
            if (value && typeof value === 'object') {
              value = value.value || value.label || String(value);
            }
            value = String(value).trim();
            break;

          case 'paymentMethod':
          case 'method':
            backendParamName = 'paymentMethod';
            if (value && typeof value === 'object') {
              value = value.value || value.label || String(value);
            }
            value = String(value).trim();
            break;

          case 'customerId':
          case 'customer':
            backendParamName = 'customerId';
            if (value && typeof value === 'object') {
              // Extract ID from customer object and convert to string
              const id = value.customerId || value.id;
              value = id != null ? String(id) : '';
            } else if (typeof value === 'number') {
              value = String(value);
            } else if (typeof value === 'string') {
              // Already a string, ensure it's not empty
              value = value.trim();
            } else {
              value = String(value);
            }
            break;

          case 'supplierId':
          case 'supplier':
            backendParamName = 'supplierId';
            if (value && typeof value === 'object') {
              // Extract ID from supplier object and convert to string
              const id = value.supplierId || value.id;
              value = id != null ? String(id) : '';
            } else if (typeof value === 'number') {
              value = String(value);
            } else if (typeof value === 'string') {
              // Already a string, ensure it's not empty
              value = value.trim();
            } else {
              value = String(value);
            }
            break;

          case 'paymentDateFrom':
          case 'fromDate':
          case 'startDate':
            backendParamName = 'fromDate';
            value = this.formatDateForBackend(value);
            break;

          case 'paymentDateTo':
          case 'toDate':
          case 'endDate':
            backendParamName = 'toDate';
            value = this.formatDateForBackend(value);
            break;

          case 'paymentDate':
            backendParamName = 'paymentDate';
            value = this.formatDateForBackend(value);
            break;

          default:
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
    if (dateObj) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return '';
  }

  getPaymentsByOrderId(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'order/' + id, { headers: headers });
  }

  getPaymentsByPurchaseId(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'purchase/' + id, { headers: headers });
  }

  getReceipt(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + +id + '/receipt', { headers: headers, responseType: 'blob' });
  }

  processMultiOrderPayment(request: any): Observable<Payment> {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Processed multi-order payment');
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}process-multi-order`;
    return this.http.post<Payment>(url, request, { headers });
  }

  processMultiPurchasePayment(request: any): Observable<Payment> {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Processed multi-purchase payment');
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}process-multi-purchase`;
    return this.http.post<Payment>(url, request, { headers });
  }

  /**
   * Get payments by transaction ID
   * @param transactionId - The transaction ID (e.g., "TXN-2024-ABC123")
   * @returns Observable<Payment[]> - Array of Payment objects sharing the same transaction ID
   * @throws Error with specific messages for:
   *   - 404: No payments found for this transaction ID
   *   - 400: Invalid transaction ID
   *   - 401: Unauthorized
   */
  getPaymentsByTransactionId(transactionId: string): Observable<Payment[]> {
    if (!transactionId || transactionId.trim() === '') {
      throw new Error('Transaction ID is required');
    }

    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}transaction/${encodeURIComponent(transactionId)}`;
    
    return new Observable<Payment[]>(observer => {
      this.http.get<Payment[]>(url, { headers }).subscribe({
        next: (payments) => {
          // Always return an array, even if empty
          observer.next(Array.isArray(payments) ? payments : []);
          observer.complete();
        },
        error: (error) => {
          // Handle specific error cases
          if (error.status === 404) {
            // No payments found - return empty array (not an error for this use case)
            observer.next([]);
            observer.complete();
          } else if (error.status === 400) {
            observer.error(new Error('Invalid transaction ID'));
          } else if (error.status === 401) {
            observer.error(new Error('Unauthorized - Please log in again'));
          } else {
            // Generic error
            const errorMessage = error?.error?.message || error?.message || 'Failed to fetch payments by transaction ID';
            observer.error(new Error(errorMessage));
          }
        }
      });
    });
  }
}
