import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { LicenseCapabilitiesService } from '../services/license-capabilities.service';

@Injectable({ providedIn: 'root' })
export class LicenseFeatureGuard implements CanActivate {

  constructor(
    private readonly licenseCapabilitiesService: LicenseCapabilitiesService,
    private readonly router: Router,
    private readonly messageService: MessageService,
  ) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    const requiredFeature = route.data?.['licenseFeature'] as string | undefined;
    if (!requiredFeature) {
      return true;
    }

    await this.licenseCapabilitiesService.ensureLoaded();
    if (this.licenseCapabilitiesService.isFeatureEnabled(requiredFeature)) {
      return true;
    }

    this.messageService.add({
      severity: 'warn',
      summary: 'Upgrade required',
      detail: 'Your current license plan does not include this module.',
      life: 5000,
    });
    await this.router.navigate(['/administration/my-company']);
    return false;
  }
}
