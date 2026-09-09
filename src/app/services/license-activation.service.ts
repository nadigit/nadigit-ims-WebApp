import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

/** Mirrors the body of {@code GET /api/license/activation-status}. */
export interface LicenseActivationStatus {
  licenseValid: boolean;
  /** True only for ADMIN. Everyone else is told who can act. */
  canActivate: boolean;
  /** Present for ADMIN only; an offline licence is issued against it. */
  serverId?: string;
}

/**
 * Whether this installation is unlicensed, and therefore whether the console must show the
 * activation screen instead of the application.
 *
 * An unlicensed backend answers every API except `/api/license` with 503 `LICENSE_REQUIRED`.
 * Before this existed the console did not notice: it rendered the dashboard, fired its usual
 * requests, and the operator saw a working-looking page whose every panel had failed, with no
 * hint that a licence was the reason or where to enter one.
 *
 * Two things raise the flag, because either alone leaves a gap:
 *  - a startup probe, so the screen is up before any business call is made;
 *  - `LicenseRequiredInterceptor`, for a licence that lapses mid-session.
 */
@Injectable({ providedIn: 'root' })
export class LicenseActivationService {

  private readonly activationRequiredSubject = new BehaviorSubject<boolean>(false);
  readonly activationRequired$ = this.activationRequiredSubject.asObservable();

  private statusValue: LicenseActivationStatus | null = null;

  apiProtocol: string = (window as any).__env?.apiProtocol || 'http';
  apiHost: string = (window as any).__env?.apiHost || 'localhost';
  apiPort: string = (window as any).__env?.apiPort || '8090';

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService
  ) {}

  get activationRequired(): boolean {
    return this.activationRequiredSubject.value;
  }

  get status(): LicenseActivationStatus | null {
    return this.statusValue;
  }

  /**
   * Raised by the interceptor on a 503 LICENSE_REQUIRED. Loads the status so the screen can name
   * the server and say whether this user is allowed to activate.
   */
  notifyLicenseRequired(): void {
    if (this.activationRequiredSubject.value) {
      return;
    }
    this.activationRequiredSubject.next(true);
    void this.loadStatus();
  }

  /**
   * Asks the backend directly at startup. `/api/license/activation-status` passes the gate, so a
   * definitive answer is available before the first business request.
   *
   * A transport failure is not an answer: it leaves the flag alone rather than accusing a
   * reachable-but-slow backend of being unlicensed. A genuinely unlicensed instance will be
   * caught by the interceptor moments later.
   */
  async probe(): Promise<void> {
    const status = await this.loadStatus();
    if (status && status.licenseValid === false) {
      this.activationRequiredSubject.next(true);
    }
  }

  /** Called after a licence is accepted; the backend needs no restart. */
  clear(): void {
    this.activationRequiredSubject.next(false);
  }

  private async loadStatus(): Promise<LicenseActivationStatus | null> {
    try {
      const headers = await this.buildHeaders();
      this.statusValue = await firstValueFrom(
        this.http.get<LicenseActivationStatus>(this.url('/api/license/activation-status'), { headers })
      );
      return this.statusValue;
    } catch {
      return null;
    }
  }

  private url(path: string): string {
    return this.apiProtocol + '://' + this.apiHost + ':' + this.apiPort + path;
  }

  private async buildHeaders(): Promise<HttpHeaders> {
    const token = await this.keycloakService.getToken();
    return new HttpHeaders({ Authorization: 'Bearer ' + token });
  }
}
