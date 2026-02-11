import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { MaintenanceStatus } from '../models/maintenance';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {
  jwt: any;
  schema: string = '/api/maintenance';
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(private http: HttpClient, public keycloakService: KeycloakService) { }

  loadToken() {
    this.jwt = this.keycloakService.getToken();
  }

  private async getHeaders(): Promise<HttpHeaders> {
    if (!this.jwt) {
      await this.loadToken();
    }
    return new HttpHeaders({ authorization: 'Bearer ' + this.jwt });
  }

  private getBaseUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}`;
  }

  async getStatus(): Promise<Observable<MaintenanceStatus>> {
    const headers = await this.getHeaders();
    return this.http.get<MaintenanceStatus>(this.getBaseUrl(), { headers });
  }

  async enableMaintenance(payload: { message?: string | null }): Promise<Observable<MaintenanceStatus>> {
    const headers = await this.getHeaders();
    return this.http.post<MaintenanceStatus>(`${this.getBaseUrl()}/enable`, payload, { headers });
  }

  async disableMaintenance(): Promise<Observable<MaintenanceStatus>> {
    const headers = await this.getHeaders();
    return this.http.post<MaintenanceStatus>(`${this.getBaseUrl()}/disable`, {}, { headers });
  }
}
