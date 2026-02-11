import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpErrorResponse,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { MaintenanceService } from '../services/maintenance.service';

@Injectable()
export class MaintenanceInterceptor implements HttpInterceptor {
  private static lastToastAt = 0;
  private static readonly TOAST_THROTTLE_MS = 60000;

  constructor(
    private messageService: MessageService,
    private translate: TranslateService,
    private maintenanceService: MaintenanceService
  ) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (this.isMaintenanceResponse(error)) {
          this.maybeNotifyMaintenance();
          this.refreshMaintenanceStatus();
        }
        return throwError(() => error);
      })
    );
  }

  private isMaintenanceResponse(error: HttpErrorResponse): boolean {
    if (error.status !== 503) {
      return false;
    }
    const header = error.headers?.get('X-Maintenance-Mode');
    const headerFlag = header?.toLowerCase() === 'true';
    const bodyFlag = (error.error && error.error.code === 'MAINTENANCE_MODE') || false;
    return headerFlag || bodyFlag;
  }

  private maybeNotifyMaintenance(): void {
    const now = Date.now();
    if (now - MaintenanceInterceptor.lastToastAt < MaintenanceInterceptor.TOAST_THROTTLE_MS) {
      return;
    }
    MaintenanceInterceptor.lastToastAt = now;
    this.messageService.add({
      severity: 'warn',
      summary: this.translate.instant('warning'),
      detail: this.translate.instant('maintenance_mode_writes_disabled'),
      life: 4000
    });
  }

  private refreshMaintenanceStatus(): void {
    this.maintenanceService.getStatus().then(status$ => {
      status$.subscribe({
        next: () => undefined,
        error: () => undefined
      });
    });
  }
}
