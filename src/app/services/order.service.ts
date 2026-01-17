import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

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

  saveOrder(data: any): Observable<any> {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
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
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, order, { headers: headers });
  }
  deleteOrder(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
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

  getMonthlyOrders() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'monthly', { headers: headers });
  }

  getTotalOrderedProducts() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'total-ordered-products', { headers: headers });
  }

  updateOrderStatus(id: any, order: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + "/update-status", order, { headers: headers });
  }

  processReturn(orderId: number, returnedItems: any, reason: string, notes: string | null): Observable<any> {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    // Build the query parameters
    let params = new HttpParams()
      .set('reason', reason);

    if (notes) {
      params = params.set('notes', notes);
    }
    return this.http.post<any>(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + orderId + "/returns", returnedItems, { headers: headers, params: params });
  }

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

          case 'orderDate':
            backendParamName = 'orderDate';
            // Convert date objects to yyyy-MM-dd (ISO format for LocalDate)
            if (value instanceof Date) {
              // Use local date components to avoid timezone issues
              const year = value.getFullYear();
              const month = String(value.getMonth() + 1).padStart(2, '0');
              const day = String(value.getDate()).padStart(2, '0');
              value = `${year}-${month}-${day}`;
            } else if (value && typeof value === 'string') {
              // If it's already a string, try to parse and format it
              try {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                  // Use local date components to avoid timezone issues
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  value = `${year}-${month}-${day}`;
                }
              } catch (e) {
                // If parsing fails, check if it's already in yyyy-MM-dd format
                const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!isoDateRegex.test(value)) {
                  console.warn('Date filter value is not in expected format:', value);
                }
                // Use as-is if it matches the expected format
              }
            }
            console.log('Processed orderDate filter:', { original: filterMeta.value, processed: value });
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
      orderDate: filters?.['orderDate']?.value
    });
    return this.http.get(url, { headers });
  }
}
