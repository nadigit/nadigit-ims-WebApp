import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

/** One organization the current user can access, mirroring the backend {@code OrganizationAccessDTO}. */
export interface OrganizationAccess {
  organizationId: number;
  organizationName: string;
  active: boolean;
  isDefault: boolean;
}

/**
 * Holds the active organization for the multi-organization (ENTERPRISE) feature and exposes the
 * organizations the current user can access. The active organization id is persisted in
 * localStorage under {@link ORGANIZATION_STORAGE_KEY} so {@code OrganizationScopeInterceptor} can
 * read it without a DI dependency on this service (avoiding a circular HttpClient dependency).
 *
 * On single-org deployments {@code /api/organizations/mine} returns one row and the switcher stays
 * hidden, so this service is inert there.
 */
export const ORGANIZATION_STORAGE_KEY = 'ims.activeOrganizationId';

@Injectable({ providedIn: 'root' })
export class OrganizationContextService {
  private readonly schema = '/api/organizations';
  private readonly apiProtocol: string = (window as any).__env?.apiProtocol || 'http';
  private readonly apiHost: string = (window as any).__env?.apiHost || 'localhost';
  private readonly apiPort: string = (window as any).__env?.apiPort || '8090';

  private organizations: OrganizationAccess[] = [];
  private readonly organizationsSubject = new BehaviorSubject<OrganizationAccess[]>([]);
  /** Emits the accessible organizations whenever they are (re)loaded. */
  readonly organizations$ = this.organizationsSubject.asObservable();

  constructor(private http: HttpClient, private keycloakService: KeycloakService) {}

  /** The active organization id, or null when none is selected (single-org / not yet loaded). */
  getActiveOrganizationId(): number | null {
    const raw = localStorage.getItem(ORGANIZATION_STORAGE_KEY);
    const id = raw != null ? Number(raw) : NaN;
    return Number.isFinite(id) ? id : null;
  }

  getOrganizations(): OrganizationAccess[] {
    return this.organizations;
  }

  /** True once the user can access more than one organization (i.e. the switcher is meaningful). */
  isMultiOrganization(): boolean {
    return this.organizations.length > 1;
  }

  /**
   * Loads the organizations the current user can access. Reconciles the persisted active id: if it
   * is missing or no longer accessible, falls back to the org the backend marked active/default.
   */
  async load(): Promise<OrganizationAccess[]> {
    const headers = await this.buildHeaders();
    const url = `${this.apiProtocol}://${this.apiHost}:${this.apiPort}${this.schema}/mine`;
    try {
      const orgs = await firstValueFrom(this.http.get<OrganizationAccess[]>(url, { headers }));
      this.organizations = orgs || [];
    } catch {
      this.organizations = [];
    }
    this.reconcileActiveId();
    this.organizationsSubject.next(this.organizations);
    return this.organizations;
  }

  /**
   * Switch the active organization. Persists the id and reloads the app so every view re-fetches its
   * data under the new organization scope (the simplest way to guarantee no stale, cross-org data
   * lingers in already-loaded components).
   */
  setActive(organizationId: number): void {
    if (organizationId == null || organizationId === this.getActiveOrganizationId()) {
      return;
    }
    localStorage.setItem(ORGANIZATION_STORAGE_KEY, String(organizationId));
    window.location.reload();
  }

  private reconcileActiveId(): void {
    const current = this.getActiveOrganizationId();
    const accessible = this.organizations.some((o) => o.organizationId === current);
    if (current != null && accessible) {
      return;
    }
    const fallback =
      this.organizations.find((o) => o.active) ||
      this.organizations.find((o) => o.isDefault) ||
      this.organizations[0];
    if (fallback) {
      localStorage.setItem(ORGANIZATION_STORAGE_KEY, String(fallback.organizationId));
    } else {
      localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
    }
  }

  private async buildHeaders(): Promise<HttpHeaders> {
    const token = await this.keycloakService.getToken();
    return new HttpHeaders({ Authorization: 'Bearer ' + token });
  }
}
