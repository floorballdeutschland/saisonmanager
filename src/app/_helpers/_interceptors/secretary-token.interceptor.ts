import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

const STORAGE_KEY = 'secretary_token';

@Injectable()
export class SecretaryTokenInterceptor implements HttpInterceptor {
  public intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const token = sessionStorage.getItem(STORAGE_KEY);
    if (token && request.url.startsWith(environment.apiURL)) {
      request = request.clone({
        setHeaders: { 'X-Secretary-Token': token },
      });
    }
    return next.handle(request);
  }
}
