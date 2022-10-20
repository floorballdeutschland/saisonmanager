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
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      catchError((err) => {
        console.log(request, next);
        if (err.status === 401 && !request.url.includes('login.json')) {
          // auto logout if 401 response returned from api
          this.sessionService.logout(false, true, 'Bitte einloggen.', true);
        }

        if (err.status === 403) {
          console.error(err);
          this._notificationService.error(
            'Berechtigungsfehler:' + err.error.message,
            {
              autoClose: false,
              keepAfterRouteChange: true,
            }
          );
          this._router.navigate(['/']);
        }

        if (err.status === 404) {
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
