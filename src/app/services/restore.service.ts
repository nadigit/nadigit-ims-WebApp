import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { RestoreConfig, RestoreJob, RestoreRequest, RestoreSettings } from '../models/restore';

@Injectable({
  providedIn: 'root'
})
export class RestoreService {
  jwt: any;
  schema: string = '/api/restores';
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

  async getConfig(): Promise<Observable<RestoreConfig>> {
    const headers = await this.getHeaders();
    return this.http.get<RestoreConfig>(`${this.getBaseUrl()}/config`, { headers });
  }

  async listRestores(): Promise<Observable<RestoreJob[]>> {
    const headers = await this.getHeaders();
    return this.http.get<RestoreJob[]>(this.getBaseUrl(), { headers });
  }

  async getSettings(): Promise<Observable<RestoreSettings>> {
    const headers = await this.getHeaders();
    return this.http.get<RestoreSettings>(`${this.getBaseUrl()}/settings`, { headers });
  }

  async updateSettings(enabled: boolean): Promise<Observable<RestoreSettings>> {
    const headers = await this.getHeaders();
    return this.http.post<RestoreSettings>(`${this.getBaseUrl()}/settings`, { enabled }, { headers });
  }

  async triggerRestore(backupId: number, payload: RestoreRequest): Promise<Observable<RestoreJob>> {
    const headers = await this.getHeaders();
    return this.http.post<RestoreJob>(
      `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/backups/${backupId}/restore`,
      payload,
      { headers }
    );
  }
}
