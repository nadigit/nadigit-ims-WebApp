import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { LicenseActivationService } from '../services/license-activation.service';

/**
 * Turns the backend's 503 LICENSE_REQUIRED into the activation screen.
 *
 * An unlicensed instance refuses every API except `/api/license`. Without this the refusals were
 * indistinguishable from a broken server: the dashboard rendered and each panel failed on its own,
 * so the operator saw a wall of errors rather than "activate this installation".
 *
 * Distinct from `MaintenanceInterceptor`, which also watches 503 but keys off MAINTENANCE_MODE;
 * the two never both fire. `BackendUnavailableInterceptor` deliberately ignores 503 and leaves the
 * status to whichever of the two owns it.
 */
@Injectable()
export class LicenseRequiredInterceptor implements HttpInterceptor {

  constructor(private licenseActivationService: LicenseActivationService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (this.isLicenseRequired(error)) {
          this.licenseActivationService.notifyLicenseRequired();
        }
        return throwError(() => error);
      })
    );
  }

  private isLicenseRequired(error: HttpErrorResponse): boolean {
    if (error.status !== 503) {
      return false;
    }
    // The header survives responses the browser hands us with an unparsed body.
    const header = error.headers?.get('X-License-Required');
    if (header?.toLowerCase() === 'true') {
      return true;
    }
    return error.error?.code === 'LICENSE_REQUIRED';
  }
}
