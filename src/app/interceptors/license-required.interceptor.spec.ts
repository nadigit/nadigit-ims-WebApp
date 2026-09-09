import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { of, throwError, firstValueFrom } from 'rxjs';
import { LicenseRequiredInterceptor } from './license-required.interceptor';

/**
 * The console showed a dashboard full of silently failed panels because nothing recognised the
 * backend's "this instance is not licensed" answer. These pin the recognition itself: which 503s
 * raise the activation screen, and — just as important — which ones must not.
 */
describe('LicenseRequiredInterceptor', () => {

  let notified: number;
  let interceptor: LicenseRequiredInterceptor;

  const activationServiceStub = {
    notifyLicenseRequired: () => { notified++; },
  };

  const passThroughHandler = { handle: () => of({} as any) };

  const failWith = (error: HttpErrorResponse) => ({ handle: () => throwError(() => error) });

  const response = (init: { status: number; code?: string; header?: string }) =>
    new HttpErrorResponse({
      status: init.status,
      error: init.code ? { code: init.code } : null,
      headers: init.header ? new HttpHeaders({ 'X-License-Required': init.header }) : new HttpHeaders(),
    });

  const run = async (error: HttpErrorResponse) => {
    try {
      await firstValueFrom(interceptor.intercept({} as any, failWith(error) as any));
    } catch {
      /* the interceptor must rethrow; callers still handle their own errors */
    }
  };

  beforeEach(() => {
    notified = 0;
    interceptor = new LicenseRequiredInterceptor(activationServiceStub as any);
  });

  it('raises activation on a 503 carrying the LICENSE_REQUIRED code', async () => {
    await run(response({ status: 503, code: 'LICENSE_REQUIRED' }));
    expect(notified).toBe(1);
  });

  it('raises activation on the header alone, when the body did not parse', async () => {
    await run(response({ status: 503, header: 'true' }));
    expect(notified).toBe(1);
  });

  it('ignores maintenance mode, which MaintenanceInterceptor owns', async () => {
    await run(response({ status: 503, code: 'MAINTENANCE_MODE' }));
    expect(notified).toBe(0);
  });

  it('ignores a gateway failure and a plain server error', async () => {
    await run(response({ status: 502 }));
    await run(response({ status: 500, code: 'LICENSE_REQUIRED' }));
    expect(notified).toBe(0);
  });

  it('rethrows so the caller still sees the failure', async () => {
    const error = response({ status: 503, code: 'LICENSE_REQUIRED' });
    await expectAsync(
      firstValueFrom(interceptor.intercept({} as any, failWith(error) as any))
    ).toBeRejected();
  });

  it('leaves successful responses untouched', async () => {
    await firstValueFrom(interceptor.intercept({} as any, passThroughHandler as any));
    expect(notified).toBe(0);
  });
});
