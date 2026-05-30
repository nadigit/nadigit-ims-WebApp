import { Injectable } from '@angular/core';
import { CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { ActivityProfileService } from '../services/activity-profile.service';

/**
 * When the org has no {@link ActivityProfileContext#businessActivityProfile}, ADMIN users are sent to
 * Global settings to choose one. Other roles rely on the in-app banner only.
 */
@Injectable({ providedIn: 'root' })
export class BusinessActivityProfileGuard implements CanActivate {

  constructor(
    private readonly router: Router,
    private readonly keycloak: KeycloakService,
    private readonly activityProfile: ActivityProfileService,
  ) {}

  async canActivate(_route: unknown, state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    if (!this.keycloak.isLoggedIn()) {
      return true;
    }

    let roles: string[] = [];
    try {
      const r = await this.keycloak.getUserRoles();
      roles = Array.isArray(r) ? r : [];
    } catch {
      return true;
    }

    if (!roles.includes('ADMIN')) {
      return true;
    }

    const path = (state.url || '').split('?')[0];
    if (this.isAllowedPath(path)) {
      return true;
    }

    try {
      await this.activityProfile.ensureLoaded();
    } catch {
      return true;
    }

    if (!this.activityProfile.profileSelectionRequired) {
      return true;
    }

    return this.router.createUrlTree(['/administration/settings'], {
      queryParams: { businessProfile: '1' },
    });
  }

  private isAllowedPath(path: string): boolean {
    if (path.includes('administration/settings')) {
      return true;
    }
    if (path.startsWith('/auth') || path.includes('/auth/')) {
      return true;
    }
    if (path.includes('/notfound') || path.endsWith('/notfound')) {
      return true;
    }
    return false;
  }
}
