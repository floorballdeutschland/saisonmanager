import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { LoginAnswer, User } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { Observable, of, ReplaySubject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { NotificationService } from './notification.service';
import { Subscription } from 'rxjs';
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
    map((user) => !!user)
  );

  private logoutSubscription!: Subscription;

  //   private flightsSubject = new BehaviorSubject<Flight[]>([]);
  // public flights$ = flightsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private _router: Router,
    private _notificationService: NotificationService
  ) {
    const stored_user = localStorage.getItem('user');

    if (stored_user) {
      this.currentUserSubject.next(JSON.parse(stored_user));
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
              'Der Login ist für dich noch nicht freigeschaltet. Sorry.'
            );
            this.logout(false);
          } else {
            this.currentUserSubject.next(loginAnswer.user);
            localStorage.setItem('user', JSON.stringify(loginAnswer.user));
            this._notificationService.success('Login erfolgreich.');
          }
        }

        return loginAnswer;
      }),
      catchError((error) => {
        console.error(error);

        this._notificationService.error('Login fehlgeschlagen.');

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
    localStorage.removeItem('user');

    const path = environment.apiURL + 'logout.json';
    const data = {};
    this.logoutSubscription = this.http
      .post<LoginAnswer>(path, data)
      .subscribe(() => {
        if (showotification) {
          this._notificationService.success('Logout erfolgreich.');
        }

        if (showError) {
          this._notificationService.error(message, {
            autoClose: false,
            keepAfterRouteChange: true,
          });
        }

        if (redirect) {
          this._router.navigate(['/']);
        }
      });

    setTimeout(() => {
      this.logoutSubscription.unsubscribe();
    }, 5000);
  }

  public canLoadPage(page: string): boolean {
    if (this.currentUser && this.currentUser.permissions[page]) {
      return true;
    }

    return false;
  }
}
