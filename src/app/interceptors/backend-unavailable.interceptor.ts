import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { BackendStatusService } from '../services/backend-status.service';

@Injectable()
export class BackendUnavailableInterceptor implements HttpInterceptor {
  private static lastToastAt = 0;
  private static readonly TOAST_THROTTLE_MS = 60000;

  constructor(
    private messageService: MessageService,
    private translate: TranslateService,
    private backendStatusService: BackendStatusService
  ) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      tap(() => {
        // Any successful response means backend is reachable again
        this.backendStatusService.setBackendUnavailable(false);
      }),
      catchError((error: HttpErrorResponse) => {
        if (this.isBackendUnavailable(error)) {
          this.backendStatusService.setBackendUnavailable(true);
          this.maybeNotifyUser();
        }
        return throwError(() => error);
      })
    );
  }

  private isBackendUnavailable(error: HttpErrorResponse): boolean {
    // Network error or CORS / server unreachable
    if (error.status === 0) {
      return true;
    }

    // Let MaintenanceInterceptor handle explicit maintenance mode (503)
    if (error.status === 503) {
      return false;
    }

    // Treat other 5xx errors as potential backend unavailability
    return error.status >= 500 && error.status <= 504;
  }

  private maybeNotifyUser(): void {
    const now = Date.now();
    if (now - BackendUnavailableInterceptor.lastToastAt < BackendUnavailableInterceptor.TOAST_THROTTLE_MS) {
      return;
    }
    BackendUnavailableInterceptor.lastToastAt = now;

    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('backend_unavailable_title'),
      detail: this.translate.instant('backend_unavailable_message'),
      life: 5000
    });
  }
}

