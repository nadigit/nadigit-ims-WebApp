import { Injectable } from '@angular/core';
import { AuthenticationService } from './authentication.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/stock/products/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  saveProduct(data: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, data, { headers: headers })
  }
  updateProduct(id: any, product: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, product, { headers: headers });
  }
  deleteProduct(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.delete(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }
  getProducts() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema, { headers: headers });
  }
  getProduct(id: number) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id, { headers: headers });
  }
  deactivateProduct(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.post(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + '/deactivate', { headers: headers })
  }
  getInactiveProducts() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'inactive', { headers: headers });
  }
  reactivateProduct(id: any) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.put(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + '/reactivate', { headers: headers });
  }
  getProductsOfLastWeek() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'lastWeek', { headers: headers });
  }
  printLabel(product: any, type: string) {
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}${product.productId}/label?labelType=${type}`;
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    this.http.get(url, { headers: headers, responseType: 'blob' }).subscribe(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    });
  }

  getQuickProducts() {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'quick-products', { headers: headers });
  }

  getProductPriceHistory(id: number) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    return this.http.get(this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + id + '/price-history', { headers: headers });
  }

  getProductsPaginated(
    page: number,
    size: number,
    globalFilter: string = '',
    sortBy: string = 'creationDate',
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
    if (filters) {
      Object.keys(filters).forEach(field => {
        const f = filters[field];

        if (!f || f.value == null || f.value === '') return;  // Skip empty values

        let value = f.value;
        let backendParamName = field;

        // Map PrimeNG field names to backend parameter names
        switch (field) {
          case 'categoryId':
            backendParamName = 'categoryId';
            // value should already be the enum string value from the dropdown
            if (value && typeof value === 'object' && value.categoryId) {
              value = value.categoryId;
            }
            break;

          case 'supplierId':
            backendParamName = 'supplierId';
            // value should already be the enum string value from the dropdown
            if (value && typeof value === 'object' && value.supplierId) {
              value = value.supplierId;
            }
            break;

          case 'warehouseId':
            backendParamName = 'warehouseId';
            // Extract customerId from the customer object
            if (value && typeof value === 'object' && value.warehouseId) {
              value = value.warehouseId;
            }
            break;

          case 'creationDate':
            backendParamName = 'creationDate';
            // Convert date objects to yyyy-MM-dd
            if (value instanceof Date) {
              value = value.toISOString().split('T')[0];
            }
            break;

          default:
            // For any other fields, use as-is
            break;
        }

        // Skip empty values after processing
        if (value == null || value === '') return;

        url += `&${encodeURIComponent(backendParamName)}=${encodeURIComponent(value)}`;
      });
    }

    console.log('Final URL with filters:', url);
    return this.http.get(url, { headers });
  }

  searchProductsForPurchase(searchTerm: string = '',) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    let url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}search-for-purchases`;
    if (searchTerm) {
      url += `?search=${encodeURIComponent(searchTerm)}`;
    }
    return this.http.get(url, { headers });
  }

    searchProductsForOrder(searchTerm: string = '',) {
    let headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt })
    let url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}search-for-orders`;
    if (searchTerm) {
      url += `?search=${encodeURIComponent(searchTerm)}`;
    }
    return this.http.get(url, { headers });
  }

}
