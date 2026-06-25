import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];

@Injectable()
export class CsrfInterceptor implements HttpInterceptor {
  public intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    if (
      SAFE_METHODS.includes(request.method) ||
      !request.url.startsWith(environment.apiURL)
    ) {
      return next.handle(request);
    }

    const token = this.getCsrfToken();
    if (token) {
      request = request.clone({
        setHeaders: { 'X-CSRF-Token': token },
      });
    }
    return next.handle(request);
  }

  private getCsrfToken(): string | null {
    // Beim Server-Rendering (SSR/Prerender) gibt es kein document/Cookie.
    if (typeof document === 'undefined') {
      return null;
    }
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}
