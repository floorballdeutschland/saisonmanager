import { inject, Injectable, InjectionToken } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

/**
 * API-Key für das Vorrendern (SSG). Bereitgestellt nur in
 * `app.server.module.ts`, aus der Umgebungsvariablen `PRERENDER_API_KEY`, die
 * `build-deploy.sh` beim Build setzt.
 *
 * Im Browser gibt es diesen Provider nicht, und das ist der Punkt: Bis 2026-10
 * stand hier `environment.frontendApiKey`, der Key lag damit im ausgelieferten
 * JavaScript und war ein ungedrosselter Zugang für jeden, der ihn kopierte.
 * Der Browser weist sich jetzt über eine anonyme Sitzung aus
 * (PublicSessionInterceptor).
 */
export const PRERENDER_API_KEY = new InjectionToken<string>(
  'PRERENDER_API_KEY'
);

@Injectable()
export class ApiKeyInterceptor implements HttpInterceptor {
  private readonly _key = inject(PRERENDER_API_KEY, { optional: true });

  public intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    if (this._key && request.url.startsWith(environment.apiURL)) {
      request = request.clone({
        setHeaders: { 'X-Api-Key': this._key },
      });
    }
    return next.handle(request);
  }
}
