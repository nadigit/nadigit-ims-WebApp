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

export interface ProductMovementItemDTO {
  productId: number;
  productReference: string;
  productName: string;
  warehouseId?: number | null;
  warehouseName?: string | null;
  categoryName?: string | null;
  historyDays: number;
  unitsSold: number;
  avgDailyDemand: number;
  recentDailyDemand: number;
  currentStock: number;
  daysSinceLastSale?: number | null;
  daysOfInventory?: number | null;
  sellThroughRate: number;
  stockValue: number;
  grossMarginRate?: number | null;
  movementBand: string;
  recommendedAction: string;
  priorityScore: number;
  expiringSoon: boolean;
  daysUntilExpiration?: number | null;
  reason: string;
}

export interface ProductMovementResponseDTO {
  historyDays: number;
  shopId?: number | null;
  warehouseId?: number | null;
  generatedItemsCount: number;
  generatedAt: string;
  modelVersion: string;
  snapshotDate?: string | null;
  bandCounts: { [band: string]: number };
  items: ProductMovementItemDTO[];
  narrative?: string;
}

export interface NadiPilotMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface NadiPilotPageContext {
  route?: string;
  label?: string;
  entityType?: string;
  entityId?: number;
}

export interface NadiPilotNavigationDTO {
  label: string;
  route: string;
}

export interface NadiPilotMetricDTO {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger' | string;
}

export interface NadiPilotCardRowDTO {
  title: string;
  meta?: string;
  badge?: string;
  badgeTone?: 'neutral' | 'positive' | 'warning' | 'danger' | string;
  value?: string;
}

export interface NadiPilotCardDTO {
  type: string;
  title: string;
  subtitle?: string;
  metrics?: NadiPilotMetricDTO[];
  rows?: NadiPilotCardRowDTO[];
  navigation?: NadiPilotNavigationDTO | null;
}

export interface NadiPilotProposedLineDTO {
  product: string;
  quantity: number;
}

export interface NadiPilotProposedActionDTO {
  type: string;
  summary?: string;
  fields?: { [key: string]: string };
  lines?: NadiPilotProposedLineDTO[];
}

export interface NadiPilotBriefingItemDTO {
  type: string;
  severity: 'critical' | 'warning' | 'info' | 'positive' | string;
  text: string;
  navigation?: NadiPilotNavigationDTO | null;
}

export interface NadiPilotBriefingDTO {
  headline: string;
  items: NadiPilotBriefingItemDTO[];
  generatedAt: string;
}

export interface NadiPilotAskRequest {
  message: string;
  historyDays?: number;
  horizonDays?: number;
  limit?: number;
  shopId?: number;
  warehouseId?: number;
  /** Recent prior turns (oldest first) for multi-turn memory. */
  history?: NadiPilotMessage[];
  /** The screen the user is viewing, for context-aware answers. */
  pageContext?: NadiPilotPageContext;
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
  navigationSuggestions?: NadiPilotNavigationDTO[];
  cards?: NadiPilotCardDTO[];
  proposedAction?: NadiPilotProposedActionDTO | null;
  aiNotice?: NadiPilotNoticeDTO | null;
}

/** Non-answer status surfaced to the chat (e.g. the AI model is temporarily rate-limited). */
export interface NadiPilotNoticeDTO {
  type: string;
  message: string;
  retryAfterSeconds?: number | null;
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
  private readonly movementSnapshotPath = '/api/ai/movement/slow-movers';
  private readonly movementAnalyzePath = '/api/ai/movement/analyze';
  private readonly copilotPath = '/api/ai/copilot/ask';
  private readonly copilotStreamPath = '/api/ai/copilot/ask/stream';
  private readonly copilotBriefingPath = '/api/ai/copilot/briefing';
  private readonly copilotCreateCustomerPath = '/api/ai/copilot/actions/create-customer';
  private readonly copilotCreateSupplierPath = '/api/ai/copilot/actions/create-supplier';
  private readonly copilotCreateExpensePath = '/api/ai/copilot/actions/create-expense';
  private readonly copilotComposeOrderPath = '/api/ai/copilot/actions/compose-order';
  private readonly copilotGenerateDocumentPath = '/api/ai/copilot/actions/generate-document';
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

  private get movementSnapshotUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.movementSnapshotPath}`;
  }

  private get movementAnalyzeUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.movementAnalyzePath}`;
  }

  private get copilotUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.copilotPath}`;
  }

  private get copilotStreamUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.copilotStreamPath}`;
  }

  private get copilotBriefingUrl(): string {
    return `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.copilotBriefingPath}`;
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

  /**
   * Verifies the configured market-trends provider responds (ADMIN + Enterprise license).
   */
  testTrendsConnection(): Observable<AiLlmTestResult> {
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/trends/test-connection`;
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.post<AiLlmTestResult>(url, {}, {
          headers: withAudit(h, 'Tested market-trends provider connection'),
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

  /**
   * Product movement / slow-dead-stock recommendations. Reads the fast nightly snapshot by default;
   * switches to a live computation when a shop or custom history window is requested.
   */
  getProductMovement(params: {
    limit?: number;
    concernsOnly?: boolean;
    shopId?: number;
    historyDays?: number;
  }): Observable<ProductMovementResponseDTO> {
    const useLive = params.shopId != null || params.historyDays != null;
    const url = useLive ? this.movementAnalyzeUrl : this.movementSnapshotUrl;
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.get<ProductMovementResponseDTO>(url, {
          headers: withAudit(h, 'Viewed product movement report'),
          params: {
            ...(params.limit != null ? { limit: String(params.limit) } : {}),
            ...(params.concernsOnly != null ? { concernsOnly: String(params.concernsOnly) } : {}),
            ...(useLive && params.shopId != null ? { shopId: String(params.shopId) } : {}),
            ...(useLive && params.historyDays != null ? { historyDays: String(params.historyDays) } : {}),
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

  /**
   * Streams a NadiPilot answer over SSE via fetch (EventSource can't send the Bearer header).
   * Calls onStatus/onToken as events arrive and resolves with the final meta response.
   * Rejects on network error, server error event, or if no meta event was received.
   */
  async askNadiPilotStream(
    payload: NadiPilotAskRequest,
    handlers: { onStatus?: (area: string) => void; onToken?: (text: string) => void } = {},
  ): Promise<NadiPilotResponseDTO> {
    const token = await this.keycloakService.getToken();
    const lang = this.translationService.getPreferredLanguage() || 'en';
    const res = await fetch(this.copilotStreamUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Accept-Language': lang,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok || !res.body) {
      throw new Error(`NadiPilot stream failed: ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let meta: NadiPilotResponseDTO | null = null;
    let errorMessage: string | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const evt = this.parseSseEvent(rawEvent);
        if (!evt) {
          continue;
        }
        if (evt.event === 'status') {
          handlers.onStatus?.(evt.data?.area || 'working');
        } else if (evt.event === 'token') {
          handlers.onToken?.(evt.data?.text ?? '');
        } else if (evt.event === 'meta') {
          meta = evt.data as NadiPilotResponseDTO;
        } else if (evt.event === 'error') {
          errorMessage = evt.data?.message || 'stream error';
        }
      }
    }
    if (errorMessage) {
      throw new Error(errorMessage);
    }
    if (!meta) {
      throw new Error('NadiPilot stream ended without a result.');
    }
    return meta;
  }

  private parseSseEvent(raw: string): { event: string; data: any } | null {
    const lines = raw.split('\n');
    let event = 'message';
    let dataStr = '';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataStr += line.slice(5).trim();
      }
    }
    if (!dataStr) {
      return { event, data: null };
    }
    try {
      return { event, data: JSON.parse(dataStr) };
    } catch {
      return { event, data: null };
    }
  }

  getNadiPilotBriefing(params: { shopId?: number; warehouseId?: number } = {}): Observable<NadiPilotBriefingDTO> {
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.get<NadiPilotBriefingDTO>(this.copilotBriefingUrl, {
          headers: h,
          params: {
            ...(params.shopId != null ? { shopId: String(params.shopId) } : {}),
            ...(params.warehouseId != null ? { warehouseId: String(params.warehouseId) } : {}),
          },
        }),
      ),
    );
  }

  createNadiPilotCustomer(payload: {
    firstName?: string; lastName?: string; companyName?: string;
    email?: string; phoneNumber?: string; city?: string;
  }): Observable<{ customerId: number; name: string; route: string }> {
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.copilotCreateCustomerPath}`;
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.post<{ customerId: number; name: string; route: string }>(url, payload, {
          headers: withAudit(h, 'Created customer from AI copilot'),
        }),
      ),
    );
  }

  createNadiPilotSupplier(payload: {
    name?: string; email?: string; phoneNumber?: string; city?: string;
  }): Observable<{ supplierId: number; name: string; route: string }> {
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.copilotCreateSupplierPath}`;
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.post<{ supplierId: number; name: string; route: string }>(url, payload, {
          headers: withAudit(h, 'Created supplier from AI copilot'),
        }),
      ),
    );
  }

  createNadiPilotExpense(payload: {
    amount?: number; purpose?: string; shopId?: number;
  }): Observable<{ expenseId: number; reference: string; route: string }> {
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.copilotCreateExpensePath}`;
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.post<{ expenseId: number; reference: string; route: string }>(url, payload, {
          headers: withAudit(h, 'Created expense from AI copilot'),
        }),
      ),
    );
  }

  composeNadiPilotOrder(payload: {
    customer?: string; shopId?: number; warehouseId?: number; documentType?: string;
    lines: { product: string; quantity: number }[];
  }): Observable<{
    orderId: number; reference: string; totalAmount?: number; route: string;
    documentId?: number; documentNumber?: string; documentType?: string; fileUrl?: string; documentError?: string;
  }> {
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.copilotComposeOrderPath}`;
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.post<{
          orderId: number; reference: string; totalAmount?: number; route: string;
          documentId?: number; documentNumber?: string; documentType?: string; fileUrl?: string; documentError?: string;
        }>(url, payload, {
          headers: withAudit(h, 'Created order from AI copilot'),
        }),
      ),
    );
  }

  generateNadiPilotDocument(payload: { order: string; documentType: string }): Observable<{
    documentId: number; documentNumber: string; documentType: string;
    orderId: number; orderReference: string; fileUrl?: string; route: string;
  }> {
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.copilotGenerateDocumentPath}`;
    return from(this.getHeaders()).pipe(
      switchMap(h =>
        this.http.post<{
          documentId: number; documentNumber: string; documentType: string;
          orderId: number; orderReference: string; fileUrl?: string; route: string;
        }>(url, payload, {
          headers: withAudit(h, 'Generated financial document from AI copilot'),
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
