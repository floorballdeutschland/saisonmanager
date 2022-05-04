import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { LoginAnswer, User } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { BehaviorSubject, Observable, ReplaySubject, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationService } from './notification.service';

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

  //   private flightsSubject = new BehaviorSubject<Flight[]>([]);
  // public flights$ = flightsSubject.asObservable();

  constructor(
    private http: HttpClient,
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
          this.currentUserSubject.next(loginAnswer.user);
          localStorage.setItem('user', JSON.stringify(loginAnswer.user));
          this._notificationService.success('Login erfolgreich.');
        }

        return loginAnswer;
      })
    );
  }

  public logout() {
    localStorage.removeItem('user');
    this._notificationService.success('Logout erfolgreich.');
    this.currentUserSubject.next(null);
  }
}
