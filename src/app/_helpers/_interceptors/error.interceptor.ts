import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationService, SessionService } from '@floorball/core';
import { Router } from '@angular/router';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private sessionService: SessionService,
    private _router: Router,
    private _notificationService: NotificationService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  // Fehlerdetails aus dem Response-Body ziehen. Rails-Endpunkte liefern
  // wahlweise { message }, { error } oder { errors: [...] } (z. B. bei 422
  // aus ActiveModel-Validierungen) — alle drei Formen auswerten, damit der
  // Interceptor die spezifische Meldung zeigt statt einer generischen (#84).
  private errorDetail(err: {
    error?: { message?: string; error?: string; errors?: string[] };
  }): string | undefined {
    if (err.error?.message) return err.error.message;
    if (err.error?.error) return err.error.error;
    if (Array.isArray(err.error?.errors) && err.error.errors.length > 0) {
      return err.error.errors.join(', ');
    }
    return undefined;
  }

  public intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((err) => {
        // Beim Server-Rendering (Prerender) keine Browser-Seiteneffekte
        // (logout, Navigation, Notifications). Zudem ein echtes Error-Objekt
        // werfen, damit ein fehlgeschlagener API-Call den Prerender-Worker
        // nicht an einem String-Reject hängen lässt ("catch clause variable
        // is not an Error instance"). Im Browser wird weiter unten die
        // ursprüngliche HttpErrorResponse weitergereicht (Objekt mit .status,
        // .message und .error), damit Component-Handler auf diese Felder
        // zugreifen können.
        if (!isPlatformBrowser(this.platformId)) {
          const serverError = this.errorDetail(err) || err.statusText;
          return throwError(() => new Error(serverError));
        }

        // Die Bestätigungsseite für E-Mail-Änderungen (/email-bestaetigen)
        // rendert Fehler (ungültiger/abgelaufener Link) als eigene Ansicht –
        // keine globalen Toasts oder Redirects für diesen Endpoint.
        if (request.url.includes('user/email/confirm')) {
          return throwError(() => err);
        }

        if (err.status === 401 && !request.url.includes('login.json')) {
          const returnUrl = this._router.url;
          this.sessionService.logout(false, true, 'Bitte einloggen.', false);
          this._router.navigate(['/login'], { queryParams: { returnUrl } });
        }

        if (err.status === 403) {
          this._notificationService.error(
            'Berechtigungsfehler: ' + (this.errorDetail(err) || 'Kein Zugriff'),
            {
              autoClose: false,
              keepAfterRouteChange: true,
            }
          );
          this._router.navigate(['/']);
        }

        if (err.status === 404 && !request.url.includes('/user/referees/')) {
          console.error(err);
          this._notificationService.error(
            'Nicht gefunden: ' +
              (this.errorDetail(err) || 'Ressource nicht gefunden'),
            {
              autoClose: false,
              keepAfterRouteChange: true,
            }
          );
        }

        // Übrige 4xx (z. B. 400, 409, 422) sichtbar machen. Bisher wurden diese
        // stillschweigend verschluckt ("der Button tut nichts"). 401/403/404
        // sind oben bereits gesondert behandelt.
        if (
          err.status >= 400 &&
          err.status < 500 &&
          ![401, 403, 404].includes(err.status)
        ) {
          this._notificationService.error(
            this.errorDetail(err) ||
              'Die Eingabe konnte nicht verarbeitet werden.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        }

        if (err.status >= 500) {
          this._notificationService.error(
            'Server-Fehler. Bitte versuche es später erneut.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        }

        if (err.status === 0) {
          this._notificationService.error(
            'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        }

        // Die ursprüngliche HttpErrorResponse weiterreichen (statt eines bloßen
        // Strings): aufrufende error-Handler können so auf .status, .message und
        // den .error-Body (inkl. errors[]) zugreifen.
        return throwError(() => err);
      })
    );
  }
}
