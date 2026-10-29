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
import * as Sentry from '@sentry/angular';
import {
  NotificationService,
  PublicSessionService,
  SKIP_PUBLIC_SESSION,
} from '@floorball/core';
import { environment } from 'src/environments/environment';

/**
 * Die API weist einen öffentlichen Abruf ohne Anmeldung, Key und Sitzung mit
 * 401 und diesem Code ab. Ein 401 ohne ihn behandelt der ErrorInterceptor wie
 * bisher als Anmeldefehler.
 */
export function isPublicSessionRequired(err: unknown): boolean {
  return (
    err instanceof HttpErrorResponse &&
    err.status === 401 &&
    (err.error as { code?: unknown } | null)?.code === 'public_session_required'
  );
}

/**
 * Meldungen, wenn die Seite ohne Sitzung bleibt. Anzeigen und Zurücknehmen
 * benutzen denselben Text, `dismiss` sucht über Textgleichheit.
 */
export const PUBLIC_SESSION_BUSY_MESSAGE =
  'Gerade sind sehr viele Besucher im selben Netz. Die Daten konnten noch nicht geladen werden, die Seite versucht es weiter.';
export const PUBLIC_SESSION_COOKIE_MESSAGE =
  'Die Daten konnten nicht geladen werden. Bitte Cookies für diese Seite erlauben und die Seite neu laden.';

/**
 * Holt bei Bedarf eine anonyme Sitzung (PublicSessionService) und wiederholt
 * den abgewiesenen Abruf einmal.
 *
 * Registriert als letzter Interceptor, also innerster: Antworten laufen von
 * innen nach außen, so sieht er das 401 vor dem ErrorInterceptor. Der lässt
 * ein 401 mit diesem Code zusätzlich selbst still durch; auch in umgekehrter
 * Reihenfolge würde also niemand abgemeldet.
 *
 * Bleibt die Seite trotzdem ohne Sitzung, meldet er das hier und nur hier,
 * denn nur er weiß, warum:
 * - Das Holen scheitert an der Grenze je Adresse, auch nach allem Warten
 *   (volle Halle). Andere Fehler beim Holen (5xx, Netz) zeigt der
 *   ErrorInterceptor wie jeden Abruf.
 * - Das Holen klappt, die Wiederholung wird aber wieder abgewiesen: Der
 *   Browser nimmt das Cookie nicht an. Dann holt dieser Tab keine Sitzungen
 *   mehr, sonst kostete jeder 30-Sekunden-Abruf ein neues Ausstellen aus dem
 *   Kontingent, das sich alle hinter derselben Adresse teilen.
 *
 * Nur im Browser. Beim Vorrendern weist sich der Server mit dem Prerender-Key
 * aus (ApiKeyInterceptor), ein Cookie gibt es dort nicht.
 */
@Injectable()
export class PublicSessionInterceptor implements HttpInterceptor {
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly _publicSession = inject(PublicSessionService);
  private readonly _notifications = inject(NotificationService);

  // Merker für die Lebensdauer des Tabs (Interceptor ist ein Singleton).
  private _cookiesRejected = false;
  private _busyNoticeShown = false;

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
        if (!isPublicSessionRequired(err) || this._cookiesRejected) {
          return throwError(() => err);
        }

        return this._publicSession.ensure().pipe(
          // Weitergereicht wird das ursprüngliche 401, das der
          // ErrorInterceptor still durchlässt. Ein 5xx oder Netzfehler beim
          // Holen hat er schon gemeldet; das ausgeschöpfte 429 nicht, das
          // meldet failedToFetch.
          catchError((fetchErr: unknown) => {
            this.failedToFetch(fetchErr);
            return throwError(() => err);
          }),
          switchMap(() => {
            this.withdrawBusyNotice();
            return next.handle(request).pipe(
              catchError((retryErr: unknown) => {
                if (isPublicSessionRequired(retryErr)) {
                  this.cookieRejected();
                }
                return throwError(() => retryErr);
              })
            );
          })
        );
      })
    );
  }

  private failedToFetch(fetchErr: unknown): void {
    if (!(fetchErr instanceof HttpErrorResponse) || fetchErr.status !== 429) {
      return;
    }
    // Alle Abrufe, die auf dasselbe Holen gewartet haben, landen hier; Meldung
    // und Sentry-Eintrag gibt es trotzdem nur einmal.
    if (this._busyNoticeShown) return;
    this._busyNoticeShown = true;
    this._notifications.warning(PUBLIC_SESSION_BUSY_MESSAGE, {
      autoClose: false,
      keepAfterRouteChange: true,
    });
    Sentry.captureMessage(
      'Anonyme Sitzung: Grenze je Adresse auch nach allen Versuchen erreicht',
      'warning'
    );
  }

  private withdrawBusyNotice(): void {
    if (this._busyNoticeShown) {
      this._busyNoticeShown = false;
      this._notifications.dismiss(PUBLIC_SESSION_BUSY_MESSAGE);
    }
  }

  private cookieRejected(): void {
    if (this._cookiesRejected) return;
    this._cookiesRejected = true;
    this._notifications.error(PUBLIC_SESSION_COOKIE_MESSAGE, {
      autoClose: false,
      keepAfterRouteChange: true,
    });
    Sentry.captureMessage(
      'Anonyme Sitzung ausgestellt, Cookie kommt nicht zurück',
      'warning'
    );
  }
}
