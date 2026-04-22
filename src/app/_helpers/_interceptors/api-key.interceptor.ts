import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable()
export class ApiKeyInterceptor implements HttpInterceptor {
  public intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const key = environment.frontendApiKey;
    if (key && request.url.startsWith(environment.apiURL)) {
      request = request.clone({
        setHeaders: { 'X-Api-Key': key },
      });
    }
    return next.handle(request);
  }
}
