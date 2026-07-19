import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';

import { LoginAnswer, User } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { Observable, of, ReplaySubject } from 'rxjs';
import { catchError, map, startWith, take } from 'rxjs/operators';
import { NotificationService } from './notification.service';
import { AppLanguage, DEFAULT_LANG } from '../_i18n/lang';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  public currentUser: User | undefined;

  private currentUserSubject = new ReplaySubject<User | null>();

  public currentUser$: Observable<User | null> =
    this.currentUserSubject.asObservable();
  public isLoggedIn$: Observable<boolean> = this.currentUserSubject.pipe(
    startWith(false),
    map((user) => !!user)
  );

  //   private flightsSubject = new BehaviorSubject<Flight[]>([]);
  // public flights$ = flightsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private _router: Router,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService
  ) {
    // Beim Server-Rendering (SSR/Prerender) existiert kein localStorage –
    // dann startet die App ohne persistierte Session.
    const stored_user =
      typeof localStorage === 'undefined' ? null : localStorage.getItem('user');

    if (stored_user) {
      const user: User = JSON.parse(stored_user);
      this.currentUserSubject.next(user);
      this._transloco.setActiveLang(user.language ?? DEFAULT_LANG);
    }
  }

  public login(username: string, password: string) {
    const path = environment.apiURL + 'login.json';
    const data = {
      username: username,
      password: password,
    };
    return this.http.post<LoginAnswer>(path, data).pipe(
      map((loginAnswer) => {
        if (loginAnswer.success) {
          if (loginAnswer.user.permissions['login_blocked']) {
            this._notificationService.error(
              loginAnswer.user.login_blocked_message ??
                this._transloco.translate('session.loginBlocked'),
              {
                autoClose: false,
                keepAfterRouteChange: true,
              }
            );
            this.logout(false);
          } else {
            this._transloco.setActiveLang(
              loginAnswer.user.language ?? DEFAULT_LANG
            );
            this.currentUserSubject.next(loginAnswer.user);
            localStorage.setItem('user', JSON.stringify(loginAnswer.user));
            this._notificationService.success(
              this._transloco.translate('session.loginSuccess')
            );
          }
        }

        return loginAnswer;
      }),
      catchError((error) => {
        console.error(error);

        this._notificationService.error(
          this._transloco.translate('session.loginFailed')
        );

        return of();
      })
    );
  }

  public logout(
    showotification = true,
    showError = false,
    message = '',
    redirect = false
  ) {
    this.currentUserSubject.next(null);
    // logout() wird beim Prerender via ErrorInterceptor (401) ausgelöst, wo
    // kein localStorage existiert – dort gibt es keine persistierte Session.
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('user');
    }

    const path = environment.apiURL + 'logout.json';
    const data = {};
    this.http
      .post<LoginAnswer>(path, data)
      .pipe(take(1))
      .subscribe(() => {
        if (showotification) {
          this._notificationService.success(
            this._transloco.translate('session.logoutSuccess')
          );
        }

        if (showError) {
          this._notificationService.error(message, {
            autoClose: false,
            keepAfterRouteChange: true,
          });
        }

        if (redirect) {
          this._router.navigate(['/login']);
        }
      });
  }

  public lostPassword(username: string) {
    const path = environment.apiURL + 'lost_password.json';
    const data = {
      username: username,
    };
    return this.http.post<LoginAnswer>(path, data).pipe(
      map((loginAnswer) => {
        this._notificationService.success(
          this._transloco.translate('session.lostPasswordSent'),
          {
            autoClose: false,
            keepAfterRouteChange: true,
          }
        );

        return loginAnswer;
      }),
      catchError((error) => {
        console.error(error);

        this._notificationService.error(
          this._transloco.translate('session.lostPasswordError'),
          {
            autoClose: false,
            keepAfterRouteChange: false,
          }
        );

        return of();
      })
    );
  }

  public resetPassword(
    resetToken: string,
    password: string,
    password_confirmation: string
  ) {
    const path = environment.apiURL + 'reset_password.json';
    const data = {
      user: {
        password: password,
        password_confirmation: password_confirmation,
      },
      reset_token: resetToken,
    };
    return this.http.post<LoginAnswer>(path, data).pipe(
      map((loginAnswer) => {
        this._notificationService.success(
          this._transloco.translate('session.passwordSet'),
          {
            autoClose: true,
            keepAfterRouteChange: true,
          }
        );

        return loginAnswer;
      }),
      catchError((error) => {
        console.error(error);

        this._notificationService.error(
          this._transloco.translate('session.passwordResetError'),
          {
            autoClose: false,
            keepAfterRouteChange: false,
          }
        );

        return of();
      })
    );
  }

  /**
   * Setzt die Oberflächensprache des eingeloggten Users. Persistiert die Wahl
   * im Backend, aktualisiert den gecachten User und lädt anschließend die Seite
   * neu, damit auch der Angular-LOCALE_ID (date/number/currency-Pipes) folgt.
   */
  public setLanguage(lang: AppLanguage) {
    const path = environment.apiURL + 'user/language.json';
    return this.http.patch<LoginAnswer>(path, { language: lang }).pipe(
      map((answer) => {
        if (answer.success) {
          this.currentUserSubject.next(answer.user);
          localStorage.setItem('user', JSON.stringify(answer.user));
          this._transloco.setActiveLang(lang);
          window.location.reload();
        }

        return answer;
      })
    );
  }

  /**
   * Schaltet den Empfang informeller System-Mails an/aus (nur Teammanager).
   * Aktualisiert den gespeicherten User aus der Server-Antwort (kein Reload).
   */
  public updateMailPreferences(receiveInfoMails: boolean) {
    const path = environment.apiURL + 'user/mail-preferences.json';
    return this.http
      .patch<LoginAnswer>(path, { receive_info_mails: receiveInfoMails })
      .pipe(
        map((answer) => {
          if (answer.success) {
            this.currentUser = answer.user;
            this.currentUserSubject.next(answer.user);
            localStorage.setItem('user', JSON.stringify(answer.user));
          }

          return answer;
        })
      );
  }

  /**
   * Stößt die Änderung der eigenen E-Mail-Adresse an (Double-Opt-In): Die neue
   * Adresse wird erst aktiv, nachdem der per Mail verschickte Bestätigungslink
   * (24h gültig) geklickt wurde. Aktualisiert den gespeicherten User aus der
   * Server-Antwort (enthält pending_email). Fehler behandelt das aufrufende
   * Component.
   */
  public requestEmailChange(currentPassword: string, email: string) {
    const path = environment.apiURL + 'user/email.json';
    return this.http
      .patch<LoginAnswer>(path, { current_password: currentPassword, email })
      .pipe(
        map((answer) => {
          if (answer.success) {
            this.currentUser = answer.user;
            this.currentUserSubject.next(answer.user);
            localStorage.setItem('user', JSON.stringify(answer.user));
          }

          return answer;
        })
      );
  }

  /**
   * Bestätigt eine E-Mail-Änderung mit dem Token aus dem Mail-Link
   * (öffentliche Seite /email-bestaetigen). Fehlerbehandlung im Component;
   * der ErrorInterceptor lässt diesen Endpoint bewusst unangetastet.
   */
  public confirmEmailChange(token: string) {
    const path = environment.apiURL + 'user/email/confirm.json';
    return this.http.post<{ success: boolean; email?: string }>(path, {
      token,
    });
  }

  /**
   * Ändert das eigene Passwort. Fehler (z. B. 422 bei falschem aktuellen
   * Passwort) werden vom aufrufenden Component behandelt – der ErrorInterceptor
   * verschluckt 422 still und reicht die Server-Nachricht als String durch.
   */
  public changePassword(
    currentPassword: string,
    password: string,
    passwordConfirmation: string
  ) {
    const path = environment.apiURL + 'user/password.json';
    return this.http.put<{ success: boolean; message?: string }>(path, {
      current_password: currentPassword,
      password: password,
      password_confirmation: passwordConfirmation,
    });
  }

  /**
   * Synchroner Zugriff auf den eingeloggten User aus dem persistierten
   * localStorage – dieselbe Quelle, aus der `currentUser$` beim Start gespeist
   * wird und aus der die Menü-Sichtbarkeit (`showItem`) ihre Permissions liest.
   * Wird von den Route-Guards genutzt, die synchron entscheiden müssen.
   */
  public get currentUserValue(): User | null {
    const stored =
      typeof localStorage === 'undefined' ? null : localStorage.getItem('user');

    return stored ? (JSON.parse(stored) as User) : null;
  }

  public canLoadPage(page: string): boolean {
    return !!this.currentUserValue?.permissions?.[page];
  }
}
