import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Subscription } from 'rxjs';
import { BrandLogoComponent } from '../brand-logo';
import { LicenseActivationService, LicenseActivationStatus } from '../../services/license-activation.service';
import { LicenseCapabilitiesService } from '../../services/license-capabilities.service';
import { SessionAuditService } from '../../services/session-audit.service';

/**
 * The screen an unlicensed installation shows instead of the application.
 *
 * It is deliberately a blocking overlay rather than a route: the flag can be raised at any moment
 * by any request, and a route change would race the navigation the user was already making. It
 * covers the console because nothing behind it works — every API but this one answers 503.
 *
 * Activation takes effect without a restart (the backend re-reads validity per request), so on
 * success the page reloads rather than asking the operator to restart anything.
 */
@Component({
  selector: 'app-license-activation',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonModule, InputTextModule, BrandLogoComponent],
  templateUrl: './license-activation.component.html',
  styleUrls: ['./license-activation.component.scss'],
})
export class LicenseActivationComponent implements OnInit, OnDestroy {

  status: LicenseActivationStatus | null = null;
  registrationKey = '';
  offlineFile: File | null = null;
  busy = false;
  errorMessage: string | null = null;
  serverIdCopied = false;

  private statusPollSub?: Subscription;

  constructor(
    private licenseActivationService: LicenseActivationService,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
    private sessionAuditService: SessionAuditService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.status = this.licenseActivationService.status;
    // The status request is in flight when the overlay first paints; pick it up when it lands.
    this.statusPollSub = this.licenseActivationService.activationRequired$.subscribe(() => {
      this.status = this.licenseActivationService.status;
    });
  }

  ngOnDestroy(): void {
    this.statusPollSub?.unsubscribe();
  }

  get canActivate(): boolean {
    // Until the status lands, assume the user may act: an admin should not watch a spinner, and a
    // non-admin who tries is refused by the backend anyway.
    return this.status?.canActivate !== false;
  }

  get serverId(): string | null {
    return this.status?.serverId || null;
  }

  onOfflineFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.offlineFile = input?.files && input.files.length > 0 ? input.files[0] : null;
  }

  async copyServerId(): Promise<void> {
    if (!this.serverId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.serverId);
      this.serverIdCopied = true;
      setTimeout(() => (this.serverIdCopied = false), 2000);
    } catch {
      /* clipboard blocked (insecure origin, permissions) — the id is selectable on screen */
    }
  }

  async applyRegistrationKey(): Promise<void> {
    const key = this.registrationKey?.trim();
    if (!key) {
      this.errorMessage = this.translate.instant('license_activation_key_required');
      return;
    }
    await this.activate(() => this.licenseCapabilitiesService.updateRegistrationKey(key));
  }

  async uploadOfflineLicense(): Promise<void> {
    if (!this.offlineFile) {
      this.errorMessage = this.translate.instant('license_activation_file_required');
      return;
    }
    await this.activate(() => this.licenseCapabilitiesService.uploadOfflineLicense(this.offlineFile as File));
  }

  signOut(): void {
    void this.sessionAuditService.logout(window.location.origin + '/webconsole');
  }

  private async activate(action: () => Promise<unknown>): Promise<void> {
    this.busy = true;
    this.errorMessage = null;
    try {
      await action();
      this.licenseActivationService.clear();
      // Reload rather than patch state: guards, menus and resolvers all read capabilities that
      // were unavailable while the gate was closed.
      window.location.reload();
    } catch (error: any) {
      this.errorMessage =
        error?.error?.message ||
        error?.error?.details ||
        this.translate.instant('license_activation_failed');
    } finally {
      this.busy = false;
    }
  }
}
