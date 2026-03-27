import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, firstValueFrom } from 'rxjs';
import { AuditLog, AuditLogFilters, AuditLogResponse } from '../models/audit-log';

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  jwt: any;
  schema: string = '/api/audit-logs';
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(
    private http: HttpClient,
    public keycloakService: KeycloakService
  ) {}

  async loadToken(): Promise<void> {
    this.jwt = await this.keycloakService.getToken();
  }

  async getAuditLogs(filters: AuditLogFilters): Promise<Observable<AuditLogResponse>> {
    await this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams();

    if (filters.userId) {
      params = params.set('userId', filters.userId);
    }
    if (filters.actionType) {
      params = params.set('actionType', filters.actionType);
    }
    if (filters.resourceType) {
      params = params.set('resourceType', filters.resourceType);
    }
    if (filters.startDate) {
      params = params.set('startDate', filters.startDate);
    }
    if (filters.endDate) {
      params = params.set('endDate', filters.endDate);
    }
    if (filters.success !== undefined && filters.success !== null) {
      params = params.set('success', filters.success.toString());
    }
    if (filters.page !== undefined) {
      params = params.set('page', filters.page.toString());
    }
    if (filters.size !== undefined) {
      params = params.set('size', filters.size.toString());
    }
    if (filters.sortBy) {
      params = params.set('sortBy', filters.sortBy);
    }
    if (filters.sortDir) {
      params = params.set('sortDir', filters.sortDir);
    }

    return this.http.get<AuditLogResponse>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`,
      { headers, params }
    );
  }

  async getAuditLogsByUser(userId: string, page: number = 0, size: number = 20): Promise<AuditLogResponse> {
    await this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return firstValueFrom(
      this.http.get<AuditLogResponse>(
        `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/user/${userId}`,
        { headers, params }
      )
    );
  }

  async getAuditLogsByActionType(actionType: string, page: number = 0, size: number = 20): Promise<AuditLogResponse> {
    await this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return firstValueFrom(
      this.http.get<AuditLogResponse>(
        `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/action/${actionType}`,
        { headers, params }
      )
    );
  }

  async getResourceHistory(resourceType: string, resourceId: number): Promise<AuditLog[]> {
    await this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });

    return firstValueFrom(
      this.http.get<AuditLog[]>(
        `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/resource/${resourceType}/${resourceId}`,
        { headers }
      )
    );
  }

  async getAuditSummary(startDate?: string, endDate?: string): Promise<any> {
    await this.loadToken();
    const headers = new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
    let params = new HttpParams();

    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }

    return firstValueFrom(
      this.http.get<any>(
        `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/summary`,
        { headers, params }
      )
    );
  }
}
