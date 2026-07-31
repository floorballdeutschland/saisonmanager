import {
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ControlsOf, FormControl, FormGroup } from '@ngneat/reactive-forms';
import { Validators } from '@angular/forms';
import { NotificationService, SessionService } from '@floorball/core';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import {
  PASSWORD_MIN_LENGTH,
  passwordMeetsPolicy,
} from 'src/app/_helpers/_utils/password-policy';

export interface LostPasswordFormValue {
  new_password: string;
  password_confirmation: string;
}

@Component({
  templateUrl: './lost-password.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class LostPasswordComponent implements OnInit, OnDestroy {
  public resetPasswordForm!: FormGroup<ControlsOf<LostPasswordFormValue>>;
  public error = '';

  public resetToken = '';
  private subscriptions: Subscription[] = [];

  constructor(
    private _sessionService: SessionService,
    private _router: Router,
    private _route: ActivatedRoute,
    private _notificationService: NotificationService
  ) {}

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      this.resetToken = params['resetToken'];
    });

    this.resetPasswordForm = new FormGroup({
      new_password: new FormControl('', [Validators.required]),
      password_confirmation: new FormControl('', [Validators.required]),
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

  public resetPasswordSubmit(data: LostPasswordFormValue) {
    if (!this.resetPasswordForm.valid) {
      return;
    }

    // Die Anforderungen stehen als Prüfliste unter dem Feld; hier bleibt nur
    // der Abfangfall, falls trotzdem abgeschickt wird. Verbindlich prüft der
    // Server (PasswordPolicy).
    if (!passwordMeetsPolicy(data.new_password)) {
      this._notificationService.error(
        `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen, ein Großbuchstabe und eine Ziffer.`,
        {
          autoClose: true,
          keepAfterRouteChange: false,
        }
      );

      return;
    }

    if (data.new_password !== data.password_confirmation) {
      this._notificationService.error(
        'Passwort Wiederholung stimmt nicht überein.',
        {
          autoClose: true,
          keepAfterRouteChange: false,
        }
      );

      return;
    }

    this.subscriptions.push(
      this._sessionService
        .resetPassword(
          this.resetToken,
          data.new_password,
          data.password_confirmation
        )
        .subscribe({
          next: () => {
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
