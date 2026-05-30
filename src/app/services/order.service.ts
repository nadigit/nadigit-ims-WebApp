import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { withAudit, auditSaveAction } from '../utils/audit-action';

@Injectable({
  providedIn: 'root'
})
export class OrderService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/orders/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  saveOrder(
    data: any,
    opts?: { checkoutReservationContext?: string }
  ): Observable<any> {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), auditSaveAction('order', data, 'orderId', 'reference'));
    const ctx = opts?.checkoutReservationContext?.trim();
    if (ctx) {
      headers = headers.set('X-Checkout-Reservation-Context', ctx);
    }
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, data, { headers: headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle insufficient stock errors with write-off details
        if (error.error?.code === 'insufficient_stock' || 
            error.error?.message?.includes('Net available quantity') ||
            error.error?.error?.includes('Net available quantity')) {
          return throwError(() => ({
            ...error,
            userFriendlyMessage: this.parseStockError(error.error?.message || error.error?.error || '')
          }));
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Parse stock error message to extract net available quantity and write-off info
   * Format: "Net available quantity (excluding X write-offs): Y, Requested: Z"
   */
  private parseStockError(errorMessage: string): string {
    if (!errorMessage) return '';
    
    // Extract net available quantity and write-off info from error message
    const netQtyMatch = errorMessage.match(/Net available quantity \(excluding (\d+) write-offs\): (\d+)/);
    if (netQtyMatch) {
      const writeOffs = netQtyMatch[1];
      const netAvailable = netQtyMatch[2];
      return `Insufficient stock. Only ${netAvailable} units available (${writeOffs} units written off).`;
    }
    
    // Fallback: try to extract any quantity information
    const simpleMatch = errorMessage.match(/Net available quantity[:\s]+(\d+)/);
    if (simpleMatch) {
      return `Insufficient stock. Only ${simpleMatch[1]} units available.`;
    }
    
    return errorMessage;
  }
  updateOrder(id: any, order: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Updated order');
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, order, { headers: headers });
  }
  deleteOrder(id: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Deleted order');
    return this.http.delete(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }
  getOrders() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, { headers: headers });
  }
  getOrder(orderId: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + orderId, { headers: headers });
  }
  getEligibleOrdersForReturn() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'eligible-orders-returns', { headers: headers });
  }
  getTodayOrders() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'today', { headers: headers });
  }
  get5TopProducts() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'recent-top-products', { headers: headers });
  }
  getRecentOrders() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'recent-products-sold', { headers: headers });
  }

  /**
   * Get customer-specific prices for products
   * @param customerId Customer ID
   * @param productIds Optional array of product IDs to get prices for
   * @param defaultQuantity Quantity to use for price resolution (default: 1)
   */
  getCustomerPrices(customerId: number, productIds?: number[], defaultQuantity: number = 1): Observable<any> {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams().set('defaultQuantity', defaultQuantity.toString());
    
    if (productIds && productIds.length > 0) {
      productIds.forEach(id => {
        params = params.append('productIds', id.toString());
      });
    }
    
    return this.http.get(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'customer/' + customerId + '/prices',
      { headers: headers, params: params }
    );
  }

  getMonthlyOrders() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'monthly', { headers: headers });
  }

  getTotalOrderedProducts() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'total-ordered-products', { headers: headers });
  }

  updateOrderStatus(id: any, order: any) {
    let headers = withAudit(new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt }), 'Updated order status');
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + "/update-status", order, { headers: headers });
  }

  // processReturn(orderId: number, returnedItems: any, reason: string, notes: string | null): Observable<any> {
  //   let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
  //   // Build the query parameters
  //   let params = new HttpParams()
  //     .set('reason', reason);

  //   if (notes) {
  //     params = params.set('notes', notes);
  //   }
  //   return this.http.post<any>(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + orderId + "/returns", returnedItems, { headers: headers, params: params });
  // }

  getOrdersReturns(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + "/returns", { headers: headers });
  }

  getUnpaidOrdersByCustomer(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + "unpaid/" + id, { headers: headers });
  }

  getEligibleOrdersForDocsByType(docType: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + "eligible-financial-docs/" + docType, { headers: headers });
  }

  /**
   * Get eligible orders for financial documents by type with pagination
   * @param docType Document type (INVOICE, PROFORMA_INVOICE, etc.)
   * @param page Page number (0-indexed)
   * @param size Page size
   * @param sortBy Field to sort by (default: "orderDate")
   * @param direction Sort direction - ASC or DESC (default: "DESC")
   * @param search Optional search term for order reference or customer name
   */
  getEligibleOrdersForDocsByTypePaginated(
    docType: string,
    page: number = 0,
    size: number = 20,
    sortBy: string = 'orderDate',
    direction: string = 'DESC',
    search: string | null = null
  ): Observable<any> {
    this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    
    // Ensure page and size are integers
    const pageInt = Math.floor(Number(page)) || 0;
    const sizeInt = Math.floor(Number(size)) || 20;
    
    let url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}eligible-financial-docs/${docType}?page=${pageInt}&size=${sizeInt}&sortBy=${encodeURIComponent(sortBy)}&direction=${encodeURIComponent(direction)}`;
    
    // Add search parameter only if it has a value
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    
    return this.http.get(url, { headers });
  }

  getOrdersPaginated(
    page: number,
    size: number,
    globalFilter: string = '',
    sortBy: string = 'orderDate',
    direction: string = 'DESC',
    filters?: { [field: string]: any }
  ) {
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

        console.log(`Processing filter field: ${field}`, {
          filterMeta,
          value,
          valueType: typeof value,
          isObject: value && typeof value === 'object'
        });

        // Map PrimeNG field names to backend parameter names
        switch (field) {
          case 'orderStatus':
            backendParamName = 'orderStatus';
            // Extract value if it's an object (dropdown might pass full object)
            if (value && typeof value === 'object') {
              console.log('orderStatus value is an object, extracting...', value);
              // Try to extract the value property first
              if (value.value !== undefined && value.value !== null) {
                value = value.value;
              } else if (value.label !== undefined && value.label !== null) {
                // Fallback: use label if value property doesn't exist
                value = value.label;
              } else {
                // If object has no value/label, try to stringify or use first property
                value = String(value);
              }
            }
            // Ensure value is a string and matches backend enum exactly
            // Backend enum: Ordered, Processing, Delivered, Completed, Canceled, Return_Pending, Returned, Partial_Return
            if (value !== null && value !== undefined) {
              value = String(value).trim();
              // No mapping needed - backend enum matches frontend values exactly
              // Just ensure it's a valid enum value
              const validStatuses = ['Ordered', 'Processing', 'Delivered', 'Completed', 'Canceled', 'Return_Pending', 'Returned', 'Partial_Return'];
              if (!validStatuses.includes(value)) {
                console.warn(`Invalid orderStatus value: "${value}". Valid values are:`, validStatuses);
              }
            }
            console.log('Processed orderStatus filter:', { 
              original: filterMeta.value, 
              processed: value, 
              originalType: typeof filterMeta.value,
              processedType: typeof value 
            });
            break;

          case 'paymentStatus':
            backendParamName = 'paymentStatus';
            // Extract value if it's an object (dropdown might pass full object)
            if (value && typeof value === 'object' && value.value) {
              value = value.value;
            } else if (value && typeof value === 'object' && value.label) {
              // Fallback: use label if value property doesn't exist
              value = value.label;
            }
            break;

          case 'customerId':
            backendParamName = 'customerId';
            // Extract customerId from the customer object
            if (value && typeof value === 'object' && value.customerId) {
              value = value.customerId;
            }
            break;

          case 'shopName':
            backendParamName = 'shopName';
            // Extract shopName from the shop object
            if (value && typeof value === 'object' && value.shopName) {
              value = value.shopName;
            }
            break;

        // NEW: Handle date range filtering
        case 'orderDateFrom':
        case 'fromDate':
          backendParamName = 'fromDate';
          value = this.formatDateForBackend(value);
          console.log('Processed fromDate filter:', { original: filterMeta.value, processed: value });
          break;

        case 'orderDateTo':
        case 'toDate':
          backendParamName = 'toDate';
          value = this.formatDateForBackend(value);
          console.log('Processed toDate filter:', { original: filterMeta.value, processed: value });
          break;

        case 'orderDate':
          // BACKWARD COMPATIBILITY: Keep support for single date
          backendParamName = 'orderDate';
          value = this.formatDateForBackend(value);
          console.log('Processed orderDate filter (backward compatibility):', { original: filterMeta.value, processed: value });
          break;

          // Note: Backend only supports single orderDate, not date range
          // If both startDate and endDate are provided, we'll use startDate only
          // For date range filtering, backend would need to be updated to support orderDateFrom and orderDateTo

          default:
            // For any other fields, use as-is
            break;
        }

        // Skip empty values after processing
        if (value == null || value === '') {
          console.log(`Skipping empty filter for ${field}:`, value);
          return;
        }

        const encodedValue = encodeURIComponent(value);
        url += `&${encodeURIComponent(backendParamName)}=${encodedValue}`;
        console.log(`Added filter ${backendParamName}=${encodedValue} (decoded: ${value})`);
      });
    }

    console.log('Final URL with filters:', url);
  console.log('All filter parameters:', {
    orderStatus: filters?.['orderStatus']?.value,
    paymentStatus: filters?.['paymentStatus']?.value,
    customerId: filters?.['customerId']?.value,
    shopName: filters?.['shopName']?.value,
    fromDate: filters?.['orderDateFrom']?.value || filters?.['fromDate']?.value,
    toDate: filters?.['orderDateTo']?.value || filters?.['toDate']?.value,
    orderDate: filters?.['orderDate']?.value // backward compatibility
    });
    return this.http.get(url, { headers });
  }

  // Add this helper method for consistent date formatting
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
