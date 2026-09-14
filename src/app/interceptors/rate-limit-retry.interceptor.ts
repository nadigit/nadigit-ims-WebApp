import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, retry, throwError, timer } from 'rxjs';

/**
 * Retries a request the API's rate limiter refused (HTTP 429, "Rate limit exceeded") once the
 * `Retry-After` the server sent has passed.
 *
 * The limiter answers before a request reaches any controller, so nothing was done and a retry is
 * safe whatever the method. Without it, a page that loads several lists at once could lose one to a
 * momentary burst: the Suppliers list sat on its spinner for good.
 *
 * Only the limiter's own refusal is retried. A 429 relayed from an AI provider carries its own retry
 * advice and stays with the caller that asked for it. Registered last, so the interceptors before it
 * see only the final outcome and none of them reacts to a refusal that was retried away.
 */
@Injectable()
export class RateLimitRetryInterceptor implements HttpInterceptor {
  static readonly MAX_RETRIES = 3;
  static readonly MAX_WAIT_MS = 10_000;

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      retry({
        count: RateLimitRetryInterceptor.MAX_RETRIES,
        delay: (error: unknown) =>
          RateLimitRetryInterceptor.isRateLimited(error)
            ? timer(RateLimitRetryInterceptor.waitMs(error as HttpErrorResponse))
            : throwError(() => error),
      })
    );
  }

  static isRateLimited(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse) || error.status !== 429) {
      return false;
    }
    const body = error.error;
    const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
    return text.includes('Rate limit exceeded');
  }

  /** The server's Retry-After (header, else body), 1 s when it gave none, plus jitter, capped. */
  static waitMs(error: HttpErrorResponse): number {
    const fromHeader = Number(error.headers?.get('Retry-After'));
    const fromBody = Number(error.error?.retryAfter);
    const seconds = fromHeader > 0 ? fromHeader : fromBody > 0 ? fromBody : 1;
    const jitter = Math.floor(Math.random() * 250);
    return Math.min(seconds * 1000 + jitter, RateLimitRetryInterceptor.MAX_WAIT_MS);
  }
}
