import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { TranslationService } from '../services/translation.service';

/**
 * Adds the user's current in-app language as `Accept-Language` on every outgoing request,
 * so the backend can return business/validation messages in that user's locale
 * (resolved server-side via LocaleContextHolder). Different users on the same system
 * each get responses in their own chosen language.
 */
@Injectable()
export class AcceptLanguageInterceptor implements HttpInterceptor {

  constructor(private translationService: TranslationService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Don't override callers that already set Accept-Language explicitly.
    if (req.headers.has('Accept-Language')) {
      return next.handle(req);
    }
    const lang = this.translationService.getPreferredLanguage() || 'en';
    return next.handle(req.clone({ setHeaders: { 'Accept-Language': lang } }));
  }
}
