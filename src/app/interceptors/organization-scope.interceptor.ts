import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { ORGANIZATION_STORAGE_KEY } from '../services/organization-context.service';

/**
 * Attaches the active organization as the `X-Organization-Id` header on every backend API request,
 * so the server scopes the response to that organization on a multi-organization (ENTERPRISE)
 * deployment. The backend validates this against the user's memberships (see
 * {@code OrganizationContextInterceptor}) — it is never trusted blindly.
 *
 * Reads the id straight from localStorage (written by {@link OrganizationContextService}) to avoid a
 * circular DI dependency on a service that itself uses HttpClient. On single-org installs no id is
 * stored, so nothing is added and behaviour is unchanged.
 */
@Injectable()
export class OrganizationScopeInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only tag calls to our own backend API, and never override an explicit header.
    if (req.headers.has('X-Organization-Id') || !req.url.includes('/api/')) {
      return next.handle(req);
    }
    const raw = localStorage.getItem(ORGANIZATION_STORAGE_KEY);
    if (raw == null || raw === '') {
      return next.handle(req);
    }
    return next.handle(req.clone({ setHeaders: { 'X-Organization-Id': raw } }));
  }
}
