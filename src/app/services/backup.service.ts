import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable } from 'rxjs';
import { BackupConfig, BackupJob } from '../models/backup';

@Injectable({
  providedIn: 'root'
})
export class BackupService {
  jwt: any;
  schema: string = '/api/backups';
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

  async listBackups(): Promise<Observable<BackupJob[]>> {
    const headers = await this.getHeaders();
    return this.http.get<BackupJob[]>(this.getBaseUrl(), { headers });
  }

  async getConfig(): Promise<Observable<BackupConfig>> {
    const headers = await this.getHeaders();
    return this.http.get<BackupConfig>(`${this.getBaseUrl()}/config`, { headers });
  }

  async triggerFullBackup(): Promise<Observable<BackupJob>> {
    const headers = await this.getHeaders();
    return this.http.post<BackupJob>(`${this.getBaseUrl()}/full`, {}, { headers });
  }

  async downloadBackup(id: number): Promise<Observable<HttpResponse<Blob>>> {
    const headers = await this.getHeaders();
    return this.http.get(`${this.getBaseUrl()}/${id}/download`, {
      headers,
      responseType: 'blob',
      observe: 'response'
    });
  }

  async deleteBackup(id: number): Promise<Observable<void>> {
    const headers = await this.getHeaders();
    return this.http.delete<void>(`${this.getBaseUrl()}/${id}`, { headers });
  }
}
