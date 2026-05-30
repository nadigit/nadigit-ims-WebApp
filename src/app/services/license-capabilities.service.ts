import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom, Subject } from 'rxjs';
import { TranslationService } from './translation.service';

/** Mirrors IMS {@code LicenseCapabilitiesResponse} JSON. */
export interface LicenseCapabilitiesSnapshot {
  licenseValid: boolean;
  tier: string;
  features: Record<string, boolean>;
  tierLimits: {
    maxUsers?: number;
    maxWarehouses?: number;
    maxShops?: number;
  };
}

export interface LicenseDowngradeImpactRequest {
  targetPlan: string;
}

export interface LicenseLimitBreach {
  resource: string;
  current: number;
  allowed: number;
  remediation: string;
}

export interface LicenseDowngradeImpactResponse {
  currentTier: string;
  targetTier: string;
  downgrade: boolean;
  blocked: boolean;
  newlyBlockedFeatures: string[];
  newlyBlockedApiPrefixes: string[];
  limitBreaches: LicenseLimitBreach[];
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class LicenseCapabilitiesService {
  private snapshot: LicenseCapabilitiesSnapshot | null = null;
  private loadPromise: Promise<void> | null = null;
  private readonly capabilitiesChangedSubject = new Subject<LicenseCapabilitiesSnapshot | null>();
  readonly capabilitiesChanged$ = this.capabilitiesChangedSubject.asObservable();

  apiProtocol: string = (window as any).__env.apiProtocol || 'http';
  apiHost: string = (window as any).__env.apiHost || 'localhost';
  apiPort: string = (window as any).__env.apiPort || '8090';

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService,
    private translationService: TranslationService
  ) {}

  getSnapshot(): LicenseCapabilitiesSnapshot | null {
    return this.snapshot;
  }

  getTier(): string {
    return (this.snapshot?.tier || 'STARTER').toUpperCase();
  }

  /**
   * @returns null when unlimited (enterprise / missing cap)
   */
  getMaxUsersCap(): number | null {
    const n = this.snapshot?.tierLimits?.maxUsers;
    if (n == null || n < 0) {
      return null;
    }
    return n;
  }

  /**
   * If capabilities were not loaded (missing map or empty fallback after HTTP failure),
   * returns true so the UI stays usable until a real snapshot arrives.
   *
   * When the map is present but a key is **absent**, most features are treated as off.
   * Exceptions: some modules (e.g. tax rules) may be omitted as `true` on higher tiers;
   * we infer those from tier only when the key is missing — explicit `false` always wins.
   */
  isFeatureEnabled(featureName: string): boolean {
    const features = this.snapshot?.features;
    if (!features || Object.keys(features).length === 0) {
      return true;
    }
    const value = features[featureName];
    if (value === true) {
      return true;
    }
    if (value === false) {
      return false;
    }
    return this.isFeatureEnabledWhenKeyMissing(featureName);
  }

  /**
   * Backend may send a full feature map without listing every enabled flag on Enterprise/Pro.
   */
  private isFeatureEnabledWhenKeyMissing(featureName: string): boolean {
    if (featureName === 'TAX_RULE_ENGINE') {
      const tier = this.getTier();
      return tier === 'ENTERPRISE' || tier === 'PRO';
    }
    return false;
  }

  async ensureLoaded(): Promise<void> {
    if (this.snapshot) {
      return;
    }
    if (!this.loadPromise) {
      this.loadPromise = this.load();
    }
    await this.loadPromise;
  }

  async refresh(): Promise<void> {
    this.snapshot = null;
    this.loadPromise = null;
    await this.ensureLoaded();
  }

  async updateRegistrationKey(registrationKey: string): Promise<any> {
    return this.updateRegistrationKeyWithConfirmation(registrationKey, false);
  }

  async updateRegistrationKeyWithConfirmation(
    registrationKey: string,
    confirmDowngrade = false
  ): Promise<any> {
    const headers = await this.buildHeaders();
    const params = new HttpParams().set('confirmDowngrade', String(confirmDowngrade));
    const url =
      this.apiProtocol +
      '://' +
      this.apiHost +
      ':' +
      this.apiPort +
      '/api/license/registration-key';
    const response = await firstValueFrom(
      this.http.post<any>(url, { registrationKey }, { headers, params })
    );
    await this.refresh();
    return response;
  }

  async uploadOfflineLicense(file: File, confirmDowngrade = false): Promise<any> {
    const headers = await this.buildHeaders();
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('confirmDowngrade', String(confirmDowngrade));
    const url =
      this.apiProtocol +
      '://' +
      this.apiHost +
      ':' +
      this.apiPort +
      '/api/license/offline';
    const response = await firstValueFrom(
      this.http.post<any>(url, formData, { headers, params })
    );
    await this.refresh();
    return response;
  }

  async getDowngradeImpact(targetPlan: string): Promise<LicenseDowngradeImpactResponse> {
    const headers = await this.buildHeaders();
    const url =
      this.apiProtocol +
      '://' +
      this.apiHost +
      ':' +
      this.apiPort +
      '/api/license/downgrade-impact';
    return await firstValueFrom(
      this.http.post<LicenseDowngradeImpactResponse>(
        url,
        { targetPlan } as LicenseDowngradeImpactRequest,
        { headers }
      )
    );
  }

  private async load(): Promise<void> {
    const headers = await this.buildHeaders();
    const url =
      this.apiProtocol +
      '://' +
      this.apiHost +
      ':' +
      this.apiPort +
      '/api/license/capabilities';
    try {
      this.snapshot = await firstValueFrom(
        this.http.get<LicenseCapabilitiesSnapshot>(url, { headers })
      );
    } catch {
      this.snapshot = {
        licenseValid: false,
        tier: 'STARTER',
        features: {},
        tierLimits: {},
      };
    } finally {
      this.capabilitiesChangedSubject.next(this.snapshot);
    }
  }

  private async buildHeaders(): Promise<HttpHeaders> {
    const token = await this.keycloakService.getToken();
    const lang = this.translationService.getPreferredLanguage() || 'en';
    return new HttpHeaders({
      Authorization: 'Bearer ' + token,
      'Accept-Language': lang,
    });
  }
}
