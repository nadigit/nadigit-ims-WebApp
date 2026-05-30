import { Injectable } from '@angular/core';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { AppConfigurationService } from './app-configuration.service';

export type ProcessMode = 'HYBRID' | 'TRANSACTION' | 'DOCUMENT_CHAIN';

const SALES_MODE_KEY = 'sales.process.mode';
const PURCHASE_MODE_KEY = 'purchase.process.mode';
const POS_ENABLED_KEY = 'sales.pos.enabled';

function normalizeSalesMode(raw: string | null | undefined): ProcessMode {
  const u = (raw ?? '').toUpperCase().trim();
  if (u === 'DOCUMENT_CHAIN' || u === 'TRANSACTION' || u === 'HYBRID') {
    return u;
  }
  return 'HYBRID';
}

function normalizePurchaseMode(raw: string | null | undefined): ProcessMode {
  const u = (raw ?? '').toUpperCase().trim();
  if (u === 'DOCUMENT_CHAIN' || u === 'TRANSACTION' || u === 'HYBRID') {
    return u;
  }
  return 'TRANSACTION';
}

@Injectable({ providedIn: 'root' })
export class ProcessModeService {

  private loadPromise: Promise<void> | null = null;

  salesProcessMode: ProcessMode = 'HYBRID';
  purchaseProcessMode: ProcessMode = 'TRANSACTION';
  posEnabled = true;

  /** Emits after {@link refresh} reloads flags (e.g. settings save). Sidebar menu can rebuild from this. */
  private readonly processFlagsChanged = new Subject<void>();
  readonly processFlagsChanged$: Observable<void> = this.processFlagsChanged.asObservable();

  constructor(private appConfig: AppConfigurationService) {}

  isSalesDocumentChain(): boolean {
    return this.salesProcessMode === 'DOCUMENT_CHAIN';
  }

  isPurchaseDocumentChain(): boolean {
    return this.purchaseProcessMode === 'DOCUMENT_CHAIN';
  }

  /**
   * Loads process mode flags once (or returns the in-flight promise). Safe to call multiple times.
   */
  ensureLoaded(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.loadPromise = this.loadFromApi();
    return this.loadPromise;
  }

  /**
   * Clears cache and reloads from API (e.g. after settings save).
   */
  async refresh(): Promise<void> {
    this.loadPromise = null;
    await this.ensureLoaded();
    this.processFlagsChanged.next();
  }

  private async loadFromApi(): Promise<void> {
    try {
      const [salesRaw, purchaseRaw, posVal] = await Promise.all([
        firstValueFrom(await this.appConfig.getConfigurationValue(SALES_MODE_KEY)),
        firstValueFrom(await this.appConfig.getConfigurationValue(PURCHASE_MODE_KEY)),
        firstValueFrom(await this.appConfig.getConfigurationValueAsBoolean(POS_ENABLED_KEY)),
      ]);
      this.salesProcessMode = normalizeSalesMode(typeof salesRaw === 'string' ? salesRaw : String(salesRaw ?? ''));
      this.purchaseProcessMode = normalizePurchaseMode(typeof purchaseRaw === 'string' ? purchaseRaw : String(purchaseRaw ?? ''));
      this.posEnabled = posVal !== false;
    } catch {
      this.salesProcessMode = 'HYBRID';
      this.purchaseProcessMode = 'TRANSACTION';
      this.posEnabled = true;
    }
  }
}
