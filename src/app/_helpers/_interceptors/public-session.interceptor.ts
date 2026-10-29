import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { PublicSessionService, SKIP_PUBLIC_SESSION } from '@floorball/core';
import { environment } from 'src/environments/environment';

/**
 * Die API weist einen öffentlichen Abruf ohne Anmeldung, Key und Sitzung mit
 * 401 und diesem Code ab. Ein 401 ohne ihn ist eine abgelaufene Anmeldung.
 */
export function isPublicSessionRequired(err: unknown): boolean {
  return (
    err instanceof HttpErrorResponse &&
    err.status === 401 &&
    (err.error as { code?: unknown } | null)?.code === 'public_session_required'
  );
}

/**
 * Holt bei Bedarf eine anonyme Sitzung (PublicSessionService) und wiederholt
 * den abgewiesenen Abruf einmal.
 *
 * Muss als LETZTER Interceptor registriert sein: Antworten laufen von innen
 * nach außen, nur so sieht er das 401 vor dem ErrorInterceptor, der es sonst
 * als abgelaufene Anmeldung behandelte (Abmelden, Weiterleitung auf /login).
 *
 * Nur im Browser. Beim Vorrendern weist sich der Server mit dem Prerender-Key
 * aus (ApiKeyInterceptor), ein Cookie gibt es dort nicht.
 */
@Injectable()
export class PublicSessionInterceptor implements HttpInterceptor {
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly _publicSession = inject(PublicSessionService);

  public intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    if (
      !this._isBrowser ||
      !request.url.startsWith(environment.apiURL) ||
      request.context.get(SKIP_PUBLIC_SESSION)
    ) {
      return next.handle(request);
    }

    return next.handle(request).pipe(
      catchError((err: unknown) => {
        if (!isPublicSessionRequired(err)) {
          return throwError(() => err);
        }

        return this._publicSession.ensure().pipe(
          // Scheitert schon das Holen, hat der ErrorInterceptor dessen Fehler
          // gemeldet. Weitergereicht wird das ursprüngliche 401, das er
          // still durchlässt; sonst käme dieselbe Meldung ein zweites Mal.
          catchError(() => throwError(() => err)),
          switchMap(() => next.handle(request))
        );
      })
    );
  }
}
