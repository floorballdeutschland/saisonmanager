import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  AppLanguage,
  AVAILABLE_LANGS,
  NotificationService,
  SessionService,
} from '@floorball/core';

@Component({
  templateUrl: './account.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AccountComponent {
  availableLangs = AVAILABLE_LANGS;
  activeLang$ = this._transloco.langChanges$;

  currentPassword = '';
  newPassword = '';
  newPasswordConfirmation = '';
  savingPassword = false;

  constructor(
    private _sessionService: SessionService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService
  ) {}

  public switchLanguage(lang: AppLanguage) {
    if (this._transloco.getActiveLang() === lang) {
      return;
    }

    // Lädt die Seite nach erfolgreichem PATCH neu (siehe SessionService).
    this._sessionService.setLanguage(lang).subscribe({
      error: () => {
        this._notificationService.error(
          this._transloco.translate('account.languageError')
        );
      },
    });
  }

  public submitPassword() {
    if (this.newPassword !== this.newPasswordConfirmation) {
      this._notificationService.error(
        this._transloco.translate('account.passwordMismatch')
      );
      return;
    }

    if (this.newPassword.length < 8) {
      this._notificationService.error(
        this._transloco.translate('account.passwordTooShort')
      );
      return;
    }

    this.savingPassword = true;
    this._sessionService
      .changePassword(
        this.currentPassword,
        this.newPassword,
        this.newPasswordConfirmation
      )
      .subscribe({
        next: () => {
          this.savingPassword = false;
          this.currentPassword = '';
          this.newPassword = '';
          this.newPasswordConfirmation = '';
          this._notificationService.success(
            this._transloco.translate('account.passwordChanged')
          );
        },
        // Der ErrorInterceptor verschluckt 422 still und reicht die
        // Server-Nachricht als String durch (err ist hier dieser String).
        error: (err) => {
          this.savingPassword = false;
          this._notificationService.error(
            typeof err === 'string' && err
              ? err
              : this._transloco.translate('account.passwordError')
          );
        },
      });
  }
}
