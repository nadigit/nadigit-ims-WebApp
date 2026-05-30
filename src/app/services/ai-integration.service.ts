import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { withAudit } from 'src/app/utils/audit-action';
import { TranslationService } from './translation.service';

export interface AiLlmTestResult {
  success: boolean;
  provider: string;
  message: string;
  responsePreview: string;
}

export interface ForecastItemDTO {
  productId: number;
  productReference: string;
  productName: string;
  warehouseId?: number | null;
  warehouseName?: string | null;
  shopId?: number | null;
  shopName?: string | null;
  historyDays: number;
  horizonDays: number;
  avgDailyDemand: number;
  recentDailyDemand: number;
  predictedDemand: number;
  currentStock: number;
  suggestedReorderQty?: number | null;
  estimatedStockoutInDays?: number | null;
  confidence: number;
  riskLevel: string;
}

export interface ForecastResponseDTO {
  historyDays: number;
  horizonDays: number;
  shopId?: number | null;
  warehouseId?: number | null;
  generatedItemsCount: number;
  generatedAt: string;
  modelVersion: string;
  items: ForecastItemDTO[];
  narrative?: string;
}

export interface NadiPilotAskRequest {
  message: string;
  historyDays?: number;
  horizonDays?: number;
  limit?: number;
  shopId?: number;
  warehouseId?: number;
}

export interface NadiPilotEvidenceDTO {
  code: string;
  label: string;
  value: string;
}

export interface NadiPilotActionDTO {
  actionType: string;
  title: string;
  description: string;
  productId?: number | null;
  quantity?: number | null;
}

export interface NadiPilotResponseDTO {
  answer: string;
  confidence: number;
  confidenceReasons?: string[];
  evidence: NadiPilotEvidenceDTO[];
  recommendedActions: NadiPilotActionDTO[];
  followUpQuestions?: string[];
  warnings: string[];
}

export interface NadiPilotDraftReorderRequest {
  productId: number;
  quantity: number;
  supplierId: number;
  shopId: number;
  warehouseId: number;
  purpose?: string;
}

export interface NadiPilotDraftReorderLineRequest {
  productId: number;
  quantity: number;
}

export interface NadiPilotDraftReorderBatchRequest {
  lines: NadiPilotDraftReorderLineRequest[];
  supplierId: number;
  shopId: number;
  warehouseId: number;
  purpose?: string;
}

export interface NadiPilotDraftReorderResponse {
  purchaseId: number;
  reference: string;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiIntegrationService {
  private readonly path = '/api/ai/test-connection';
  private readonly forecastPath = '/api/ai/forecasting/items';
  private readonly copilotPath = '/api/ai/copilot/ask';
  private readonly copilotDraftReorderPath = '/api/ai/copilot/actions/draft-reorder';
  private readonly copilotDraftReorderBatchPath = '/api/ai/copilot/actions/draft-reorder-batch';
  private readonly apiProtocol: string = (window as any).__env?.apiProtocol || 'http';
  private readonly apiHost: string = (window as any).__env?.apiHost || 'localhost';
  private readonly apiPort: string = (window as any).__env?.apiPort || '8090';

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService,
    private translationService: TranslationService,
  ) {}

  private get url(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.path}`;
  }

  private get forecastUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.forecastPath}`;
  }

  private get copilotUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.copilotPath}`;
  }

  private get copilotDraftReorderUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.copilotDraftReorderPath}`;
  }

  private get copilotDraftReorderBatchUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.copilotDraftReorderBatchPath}`;
  }

  private async getHeaders(): Promise<HttpHeaders> {
    const token = await this.keycloakService.getToken();
    const lang = this.translationService.getPreferredLanguage() || 'en';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': lang,
    });
  }

  /**
   * Calls backend to run a minimal JSON ping against the configured LLM (ADMIN only).
   */
  testLlmConnection(): Observable<AiLlmTestResult> {
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.post<AiLlmTestResult>(this.url, {}, {
          headers: withAudit(h, 'Tested AI / LLM connection'),
        }),
      ),
    );
  }

  getForecastItems(params: {
    historyDays?: number;
    horizonDays?: number;
    limit?: number;
    shopId?: number;
    warehouseId?: number;
    withNarrative?: boolean;
  }): Observable<ForecastResponseDTO> {
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.get<ForecastResponseDTO>(this.forecastUrl, {
          headers: withAudit(h, 'Viewed AI forecasting results'),
          params: {
            ...(params.historyDays != null ? { historyDays: String(params.historyDays) } : {}),
            ...(params.horizonDays != null ? { horizonDays: String(params.horizonDays) } : {}),
            ...(params.limit != null ? { limit: String(params.limit) } : {}),
            ...(params.shopId != null ? { shopId: String(params.shopId) } : {}),
            ...(params.warehouseId != null ? { warehouseId: String(params.warehouseId) } : {}),
            ...(params.withNarrative != null ? { withNarrative: String(params.withNarrative) } : {}),
          },
        }),
      ),
    );
  }

  askNadiPilot(payload: NadiPilotAskRequest): Observable<NadiPilotResponseDTO> {
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.post<NadiPilotResponseDTO>(this.copilotUrl, payload, {
          headers: withAudit(h, 'Asked AI copilot'),
        }),
      ),
    );
  }

  createNadiPilotDraftReorder(payload: NadiPilotDraftReorderRequest): Observable<NadiPilotDraftReorderResponse> {
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.post<NadiPilotDraftReorderResponse>(this.copilotDraftReorderUrl, payload, {
          headers: withAudit(h, 'Created draft reorder from AI copilot'),
        }),
      ),
    );
  }

  createNadiPilotDraftReorderBatch(payload: NadiPilotDraftReorderBatchRequest): Observable<NadiPilotDraftReorderResponse> {
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.post<NadiPilotDraftReorderResponse>(this.copilotDraftReorderBatchUrl, payload, {
          headers: withAudit(h, 'Created batch draft reorder from AI copilot'),
        }),
      ),
    );
  }
}
