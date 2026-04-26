import { Injectable } from '@angular/core';
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
    private _notificationService: NotificationService
  ) {}

  public intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((err) => {
        if (err.status === 401 && !request.url.includes('login.json')) {
          const returnUrl = this._router.url;
          this.sessionService.logout(false, true, 'Bitte einloggen.', false);
          this._router.navigate(['/login'], { queryParams: { returnUrl } });
        }

        if (err.status === 403) {
          this._notificationService.error(
            'Berechtigungsfehler:' + err.error.message,
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
            'Nicht gefunden:' + err.error.message,
            {
              autoClose: false,
              keepAfterRouteChange: true,
            }
          );
        }

        const error = err.error.message || err.statusText;
        return throwError(() => error);
      })
    );
  }
}
