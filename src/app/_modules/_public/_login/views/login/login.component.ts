import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ControlsOf, FormControl, FormGroup } from '@ngneat/reactive-forms';
import { Validators } from '@angular/forms';
import { NotificationService, SessionService } from '@floorball/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

export interface LoginFormValue {
  username: string;
  password: string;
}

@Component({
  templateUrl: './login.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class LoginComponent implements OnInit, OnDestroy {
  public loginForm!: FormGroup<ControlsOf<LoginFormValue>>;
  public error = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private _sessionService: SessionService,
    private _router: Router,
    private _notificationService: NotificationService
  ) {}

  public ngOnInit(): void {
    this.loginForm = new FormGroup({
      username: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required]),
    });
  }

  public ngOnDestroy() {
    if (this.subscriptions) {
      this.subscriptions.forEach((sub) => {
        if (sub && typeof sub.unsubscribe === 'function') {
          sub.unsubscribe();
        }
      });
    }
  }

  public loginSubmit(data: LoginFormValue) {
    if (!this.loginForm.valid) {
      return;
    }

    this.subscriptions.push(
      this._sessionService.login(data.username, data.password).subscribe({
        next: (data) => {
          // this.router.navigate([this.returnUrl])
          if (data.success) {
            if (data.user.permissions['show_league_index_admin']) {
              this._router.navigate(['verwaltung', 'ligen']);
            } else if (data.user.permissions['menu_item_licence_club_admin']) {
              this._router.navigate([
                '/',
                'verwaltung',
                'lizenzwesen',
                'verein',
              ]);
            } else {
              this._router.navigate(['/']);
            }
          } else {
            this._router.navigate(['/']);
          }
        },
        error: (err) => {
          console.error(err);
          this.error = err;
        },
      })
    );
  }

  public lostPassword(data: LoginFormValue) {
    if (!data.username) {
      this._notificationService.error(
        'Bitte fülle das Benutzernamen Feld aus. Benutzername nicht E-Mail',
        {
          autoClose: false,
          keepAfterRouteChange: true,
        }
      );
      return;
    }

    this.subscriptions.push(
      this._sessionService.lostPassword(data.username).subscribe({
        next: (data) => {
          // this.router.navigate([this.returnUrl])
          this._router.navigate(['/', 'login']);
        },
        error: (err) => {
          console.error(err);
          this.error = err;
        },
      })
    );
  }
}
