import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionAuditService {
  private readonly loginSentKey = 'ims_session_login_audit_sent';
  private readonly logoutSentKey = 'ims_session_logout_audit_sent';

  private readonly apiProtocol: string = (window as any).__env?.apiProtocol || 'http';
  private readonly apiHost: string = (window as any).__env?.apiHost || 'localhost';
  private readonly apiPort: string = (window as any).__env?.apiPort || '8090';

  constructor(
    private http: HttpClient,
    private keycloakService: KeycloakService,
  ) {}

  /**
   * Records login once per Keycloak session (page refresh does not duplicate).
   */
  async recordLoginIfNeeded(): Promise<void> {
    if (!this.keycloakService.isLoggedIn()) {
      return;
    }
    const sessionKey = this.resolveSessionKey();
    if (!sessionKey) {
      return;
    }
    if (sessionStorage.getItem(this.loginSentKey) === sessionKey) {
      return;
    }
    try {
      const headers = await this.buildHeaders();
      await firstValueFrom(
        this.http.post(
          `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/session-audit/login`,
          {},
          { headers },
        ),
      );
      sessionStorage.setItem(this.loginSentKey, sessionKey);
      sessionStorage.removeItem(this.logoutSentKey);
    } catch (error) {
      console.warn('Unable to record login audit event.', error);
    }
  }

  /**
   * Records logout then redirects to Keycloak end-session.
   */
  async logout(redirectUri?: string): Promise<void> {
    await this.recordLogout();
    await this.keycloakService.logout(
      redirectUri ?? `${window.location.origin}/webconsole`,
    );
  }

  private async recordLogout(): Promise<void> {
    if (!this.keycloakService.isLoggedIn()) {
      return;
    }
    if (sessionStorage.getItem(this.logoutSentKey) === '1') {
      return;
    }
    try {
      const headers = await this.buildHeaders();
      await firstValueFrom(
        this.http.post(
          `${this.apiProtocol}://${this.apiHost}:${this.apiPort}/api/session-audit/logout`,
          {},
          { headers },
        ),
      );
      sessionStorage.setItem(this.logoutSentKey, '1');
    } catch (error) {
      console.warn('Unable to record logout audit event.', error);
    }
  }

  private async buildHeaders(): Promise<HttpHeaders> {
    const token = await this.keycloakService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  private resolveSessionKey(): string | null {
    try {
      const token = this.keycloakService.getKeycloakInstance()?.token;
      if (!token) {
        return null;
      }
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload?.sid) {
        return String(payload.sid);
      }
      if (payload?.jti) {
        return String(payload.jti);
      }
      if (payload?.sub) {
        return `${payload.sub}:${payload.iat ?? ''}`;
      }
    } catch {
      return null;
    }
    return null;
  }
}
