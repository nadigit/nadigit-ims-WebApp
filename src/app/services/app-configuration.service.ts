import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { BehaviorSubject, Observable, Subject, catchError, firstValueFrom, map, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { withAudit } from '../utils/audit-action';

export interface ProcessModePipelineCounts {
  openSalesPipelineCount: number;
  openPurchasePipelineCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AppConfigurationService {

  jwt: any;
  // host2:string= environment.apiUrl;
  schema: string = "/api/app-configs/";
  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  private currencySubject = new BehaviorSubject<string | null>(null);
  public currency$ = this.currencySubject.asObservable();

  /** Emits saved config key after a successful settings update (e.g. POS/orders/products refresh without reload). */
  private readonly configurationSaved = new Subject<string>();
  readonly configurationSaved$: Observable<string> = this.configurationSaved.asObservable();

  constructor(private http: HttpClient, private keycloakService: KeycloakService) {
    this.loadToken();
  }

  async loadToken() {
    if (!this.jwt) {
      try {
        this.jwt = await this.keycloakService.getToken();
      } catch (error) {
        console.error('Error loading token:', error);
      }
    }
  }

  private async getHeaders(): Promise<HttpHeaders> {
    if (!this.jwt) {
      await this.loadToken(); // Ensure token is loaded
    }
    return new HttpHeaders({ 'authorization': 'Bearer ' + this.jwt });
  }

  async saveConfiguration(data: any, forceProcessModeChange = false): Promise<Observable<any>> {
    const headers = withAudit(await this.getHeaders(), 'Updated system configuration');
    let url = this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema;
    if (forceProcessModeChange) {
      url += '?forceProcessModeChange=true';
    }
    return this.http.post(url, data, { headers });
  }

  async getProcessModePipelineCounts(): Promise<Observable<ProcessModePipelineCounts>> {
    const headers = await this.getHeaders();
    return this.http.get<ProcessModePipelineCounts>(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema + 'process-mode-pipeline-counts',
      { headers }
    );
  }

  async getConfiguration(key: any): Promise<Observable<any>> {
    const headers = await this.getHeaders();
    return this.http.get(
      this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + key,
      { headers }
    );
  }

  async getConfigurationValue(key: any): Promise<Observable<string>> {
    const headers = await this.getHeaders();
    return this.http.get(
      this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema + key + '/value',
      { headers, responseType: 'text' }
    ).pipe(
      map((response: string) => {
        const trimmed = (response ?? '').trim();
        if (!trimmed) {
          return '';
        }
        try {
          const parsed = JSON.parse(trimmed);
          // Backend often returns a JSON primitive (e.g. bare `true`), not `{"value":"..."}` — avoid `.value` on booleans.
          if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) && 'value' in parsed) {
            return String((parsed as { value: unknown }).value);
          }
          if (typeof parsed === 'boolean') {
            return parsed ? 'true' : 'false';
          }
          if (typeof parsed === 'number') {
            return String(parsed);
          }
          if (typeof parsed === 'string') {
            return parsed;
          }
          return trimmed;
        } catch {
          return trimmed;
        }
      }),
      catchError(error => {
        console.error('Error fetching configuration value:', error);
        return throwError(error);
      })
    );
  }

  async getAllConfigurations(): Promise<Observable<any>> {
    const headers = await this.getHeaders();
    return this.http.get(
      this.apiProtocol+'://'+this.apiHost+':'+this.apiPort + this.schema,
      { headers }
    );
  }

  notifyConfigurationSaved(configKey: string): void {
    this.configurationSaved.next(configKey || '');
  }

  async loadCurrencyOnce() {
    if (this.currencySubject.getValue() !== null) return;

    try {
      const currencyObs = await this.getConfigurationValue('currency');
      const currency = await firstValueFrom(currencyObs);
      this.currencySubject.next(currency);
    } catch (error) {
      console.error('Failed to load currency:', error);
      this.currencySubject.next(null);
    }
  }

  async getSystemInfo(): Promise<Observable<any>> {
    const headers = await this.getHeaders();
    return this.http.get(
      this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + this.schema,
      { headers }
    );
  }

  /**
   * Get configuration value as boolean
   */
  async getConfigurationValueAsBoolean(key: string): Promise<Observable<boolean>> {
    return (await this.getConfigurationValue(key)).pipe(
      map(value => {
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        return Boolean(value);
      })
    );
  }

  /**
   * Get configuration value as number
   */
  async getConfigurationValueAsNumber(key: string): Promise<Observable<number>> {
    return (await this.getConfigurationValue(key)).pipe(
      map(value => {
        const num = parseFloat(String(value));
        return isNaN(num) ? 0 : num;
      })
    );
  }
  
}
