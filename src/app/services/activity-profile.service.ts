import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom, from, Observable, Subject } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { ActivityProfileContext } from '../models/activity-profile-context';
import { withAudit } from '../utils/audit-action';

/**
 * Loads org activity profile + derived capabilities (matches GET /api/organizations/activity-profile-context).
 */
@Injectable({ providedIn: 'root' })
export class ActivityProfileService {

  private loadPromise: Promise<void> | null = null;
  private readonly changed = new Subject<void>();
  readonly contextChanged$ = this.changed.asObservable();

  /** Latest context from API; null if load failed or user not authenticated. */
  context: ActivityProfileContext | null = null;

  private readonly apiProtocol: string = (window as any).__env?.apiProtocol || 'http';
  private readonly apiHost: string = (window as any).__env?.apiHost || 'localhost';
  private readonly apiPort: string = (window as any).__env?.apiPort || '8090';
  private readonly basePath = '/api/organizations';

  constructor(
    private http: HttpClient,
    private keycloak: KeycloakService,
  ) {}

  get emphasizeBatchAndExpiry(): boolean {
    return this.context?.capabilities?.emphasizeBatchAndExpiry === true;
  }

  get emphasizeProductVariants(): boolean {
    return this.context?.capabilities?.emphasizeProductVariants === true;
  }

  get emphasizeB2bWorkflow(): boolean {
    return this.context?.capabilities?.emphasizeB2bWorkflow === true;
  }

  get emphasizePosRetail(): boolean {
    return this.context?.capabilities?.emphasizePosRetail === true;
  }

  get suggestRecipesOrComponents(): boolean {
    return this.context?.capabilities?.suggestRecipesOrComponents === true;
  }

  get profileSelectionRequired(): boolean {
    return this.context?.profileSelectionRequired === true;
  }

  get currentProfile(): string | null {
    return this.context?.businessActivityProfile ?? null;
  }

  get isPharmacyProfile(): boolean {
    return this.currentProfile === 'PHARMACY';
  }

  get isFashionProfile(): boolean {
    return this.currentProfile === 'FASHION';
  }

  /** ngx-translate key for the current profile label, e.g. `business_activity_profile_PHARMACY`. */
  profileLabelI18nKey(): string {
    const p = this.context?.businessActivityProfile;
    if (p == null || String(p).trim() === '') {
      return 'business_activity_profile_not_set';
    }
    return `business_activity_profile_${p}`;
  }

  /**
   * Loads once per session unless {@link refresh} clears the cache.
   */
  ensureLoaded(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.loadPromise = this.loadFromApi();
    return this.loadPromise;
  }

  async refresh(): Promise<void> {
    this.loadPromise = null;
    await this.ensureLoaded();
    this.changed.next();
  }

  private async loadFromApi(): Promise<void> {
    try {
      const token = await this.keycloak.getToken();
      const headers = new HttpHeaders({ Authorization: 'Bearer ' + token });
      const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/activity-profile-context`;
      this.context = await firstValueFrom(this.http.get<ActivityProfileContext>(url, { headers }));
    } catch {
      this.context = null;
    }
  }

  patchActivityProfile(businessActivityProfile: string, confirmProfileChange: boolean): Observable<ActivityProfileContext> {
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.basePath}/activity-profile`;
    return from(this.keycloak.getToken()).pipe(
      switchMap((token) => {
        const headers = withAudit(
          new HttpHeaders({
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          }),
          'Updated business activity profile',
        );
        return this.http.patch<ActivityProfileContext>(url, { businessActivityProfile, confirmProfileChange }, { headers });
      }),
      tap((ctx) => {
        this.context = ctx;
        this.changed.next();
      }),
    );
  }
}
