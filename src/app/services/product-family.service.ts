import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import {
  CreateProductFamilyRequest,
  GenerateProductVariantsRequest,
  GenerateProductVariantsResponse,
  ProductFamily,
  ProductFamilyInventoryOverview,
  ProductFamilyInventoryOverviewPage,
  UpdateProductFamilyRequest,
} from '../models/product-family';
import { withAudit, auditSaveAction } from '../utils/audit-action';

@Injectable({ providedIn: 'root' })
export class ProductFamilyService {

  private readonly schema = '/api/stock/product-families/';
  private readonly apiProtocol: string = (window as any).__env?.apiProtocol || 'http';
  private readonly apiHost: string = (window as any).__env?.apiHost || 'localhost';
  private readonly apiPort: string = (window as any).__env?.apiPort || '8090';

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService,
  ) {}

  private baseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  }

  private authHeaders(auditMessage?: string): Observable<HttpHeaders> {
    return from(this.keycloakService.getToken()).pipe(
      switchMap((jwt) => {
        let headers = new HttpHeaders({ authorization: 'Bearer ' + jwt });
        if (auditMessage) {
          headers = withAudit(headers, auditMessage);
        }
        return [headers];
      }),
    );
  }

  list(search?: string, activeOnly = true): Observable<ProductFamily[]> {
    let params = new HttpParams().set('activeOnly', String(activeOnly));
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    return from(this.keycloakService.getToken()).pipe(
      switchMap((jwt) =>
        this.http.get<ProductFamily[]>(this.baseUrl(), {
          headers: new HttpHeaders({ authorization: 'Bearer ' + jwt }),
          params,
        }),
      ),
    );
  }

  getInventoryOverviewPage(
    page: number,
    size: number,
    search?: string,
    warehouseId?: number,
    activeOnly = true,
    sortBy = 'name',
    sortDir = 'asc',
  ): Observable<ProductFamilyInventoryOverviewPage> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size))
      .set('activeOnly', String(activeOnly))
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    if (warehouseId != null) {
      params = params.set('warehouseId', String(warehouseId));
    }
    return from(this.keycloakService.getToken()).pipe(
      switchMap((jwt) =>
        this.http.get<ProductFamilyInventoryOverviewPage>(`${this.baseUrl()}inventory-overview`, {
          headers: new HttpHeaders({ authorization: 'Bearer ' + jwt }),
          params,
        }),
      ),
    );
  }

  getFamilyInventoryOverview(id: number, warehouseId?: number): Observable<ProductFamilyInventoryOverview> {
    let params = new HttpParams();
    if (warehouseId != null) {
      params = params.set('warehouseId', String(warehouseId));
    }
    return from(this.keycloakService.getToken()).pipe(
      switchMap((jwt) =>
        this.http.get<ProductFamilyInventoryOverview>(`${this.baseUrl()}${id}/inventory-overview`, {
          headers: new HttpHeaders({ authorization: 'Bearer ' + jwt }),
          params,
        }),
      ),
    );
  }

  getById(id: number): Observable<ProductFamily> {
    return from(this.keycloakService.getToken()).pipe(
      switchMap((jwt) =>
        this.http.get<ProductFamily>(`${this.baseUrl()}${id}`, {
          headers: new HttpHeaders({ authorization: 'Bearer ' + jwt }),
        }),
      ),
    );
  }

  create(request: CreateProductFamilyRequest): Observable<ProductFamily> {
    return from(this.keycloakService.getToken()).pipe(
      switchMap((jwt) => {
        const headers = withAudit(
          new HttpHeaders({ authorization: 'Bearer ' + jwt }),
          auditSaveAction('product family', request, undefined, 'styleReference'),
        );
        return this.http.post<ProductFamily>(this.baseUrl(), request, { headers });
      }),
    );
  }

  update(id: number, request: UpdateProductFamilyRequest): Observable<ProductFamily> {
    return from(this.keycloakService.getToken()).pipe(
      switchMap((jwt) => {
        const headers = withAudit(new HttpHeaders({ authorization: 'Bearer ' + jwt }), 'Updated product family');
        return this.http.put<ProductFamily>(`${this.baseUrl()}${id}`, request, { headers });
      }),
    );
  }

  generateVariants(id: number, request: GenerateProductVariantsRequest): Observable<GenerateProductVariantsResponse> {
    return from(this.keycloakService.getToken()).pipe(
      switchMap((jwt) => {
        const headers = withAudit(new HttpHeaders({ authorization: 'Bearer ' + jwt }), 'Generated product variants');
        return this.http.post<GenerateProductVariantsResponse>(
          `${this.baseUrl()}${id}/generate-variants`,
          request,
          { headers },
        );
      }),
    );
  }
}
