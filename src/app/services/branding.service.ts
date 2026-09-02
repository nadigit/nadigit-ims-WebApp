import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { OrganizationService } from './organization.service';
import { AppConfigurationService } from './app-configuration.service';

/**
 * Single source of truth for the customer's own branding (currently the organization logo shown in
 * the centre of the top bar).
 *
 * Why a service rather than a fetch in the topbar component:
 *
 *  - The logo endpoint is authenticated, so `<img src="/api/organizations/uploads/logos/x.png">`
 *    would 401. It has to be fetched as a blob and wrapped in an object URL, which is a resource
 *    with a lifetime — every URL created must be revoked or the tab leaks one blob per refresh.
 *  - Several places want the same image (top bar, My Company hero, document previews). Fetching it
 *    per component means N downloads of the same bytes.
 *  - After an admin uploads a new logo the top bar has to update *without a page reload*, which
 *    needs a shared stream the upload screen can poke.
 *
 * Organization switching already triggers a full `window.location.reload()`
 * (see OrganizationContextService.setActive), so no per-org cache invalidation is needed here.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {

  /** Config key gating whether the logo is rendered in the top bar. */
  static readonly TOPBAR_LOGO_ENABLED_KEY = 'branding.topbar.logo.enabled';

  private readonly logoUrl = new BehaviorSubject<string | null>(null);
  private readonly topbarEnabled = new BehaviorSubject<boolean>(false);

  /** Object URL of the organization logo, or null when none is set / it failed to load. */
  readonly logoUrl$: Observable<string | null> = this.logoUrl.asObservable();

  /** Whether the admin has switched the top-bar logo on. */
  readonly topbarLogoEnabled$: Observable<boolean> = this.topbarEnabled.asObservable();

  private loaded = false;

  constructor(
    private organizationService: OrganizationService,
    private configService: AppConfigurationService,
  ) { }

  /** Idempotent: the first caller loads, later callers just get the current values. */
  async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    await this.refresh();
  }

  /** Re-read the toggle and the logo. Call after an admin uploads or removes a logo. */
  async refresh(): Promise<void> {
    await Promise.all([this.refreshToggle(), this.refreshLogo()]);
  }

  private async refreshToggle(): Promise<void> {
    try {
      const enabled$ = await this.configService.getConfigurationValueAsBoolean(
        BrandingService.TOPBAR_LOGO_ENABLED_KEY,
      );
      this.topbarEnabled.next(await firstValueFrom(enabled$));
    } catch {
      // Unset config or a failed read means "off" — never block the top bar on branding.
      this.topbarEnabled.next(false);
    }
  }

  private async refreshLogo(): Promise<void> {
    try {
      this.organizationService.loadToken();
      const org: any = await firstValueFrom(this.organizationService.getOrganization() as any);
      const path: string | undefined = Array.isArray(org) ? org[0]?.logo : org?.logo;

      if (!path || !path.trim()) {
        this.setLogoUrl(null);
        return;
      }

      const blob = await firstValueFrom(this.organizationService.getLogoImage(path));
      this.setLogoUrl(URL.createObjectURL(blob));
    } catch {
      // Branding is decoration: a failure here must never surface an error toast or break the bar.
      this.setLogoUrl(null);
    }
  }

  /** Swap the current object URL, revoking the one it replaces so the blob is released. */
  private setLogoUrl(next: string | null): void {
    const previous = this.logoUrl.value;
    if (previous && previous !== next) {
      try {
        URL.revokeObjectURL(previous);
      } catch {
        // already revoked
      }
    }
    this.logoUrl.next(next);
  }
}
