import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
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

  // E-Mail-Änderung (Double-Opt-In): neue Adresse wird erst nach Bestätigung
  // des Mail-Links aktiv, bis dahin zeigt pendingEmail den Schwebezustand.
  email = this._sessionService.currentUser?.email ?? '';
  pendingEmail = this._sessionService.currentUser?.pending_email ?? null;
  newEmail = '';
  emailCurrentPassword = '';
  savingEmail = false;

  // Info-Mail-Opt-out: nur für Teammanager sichtbar (Backend liefert das Gate).
  canManageMailPreferences =
    this._sessionService.currentUser?.can_manage_mail_preferences ?? false;
  receiveInfoMails =
    this._sessionService.currentUser?.receive_info_mails ?? true;
  savingMailPref = false;

  constructor(
    private _sessionService: SessionService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  public submitEmail() {
    const email = this.newEmail.trim();

    if (!email || !email.includes('@')) {
      this._notificationService.error(
        this._transloco.translate('account.emailInvalid')
      );
      return;
    }

    if (!this.emailCurrentPassword) {
      this._notificationService.error(
        this._transloco.translate('account.emailPasswordMissing')
      );
      return;
    }

    this.savingEmail = true;
    this._sessionService
      .requestEmailChange(this.emailCurrentPassword, email)
      .subscribe({
        next: (answer) => {
          this.savingEmail = false;
          if (answer.success) {
            this.pendingEmail = answer.user.pending_email ?? email;
            this.newEmail = '';
            this.emailCurrentPassword = '';
            this._notificationService.success(
              this._transloco.translate('account.emailChangeRequested')
            );
          }
          this._cdr.markForCheck();
        },
        // Fehlermeldungen (falsches Passwort, Adresse vergeben, 422) zeigt
        // bereits der ErrorInterceptor als Notification – hier nur aufräumen.
        error: () => {
          this.savingEmail = false;
          this._cdr.markForCheck();
        },
      });
  }

  public toggleInfoMails(receive: boolean) {
    this.savingMailPref = true;
    this._sessionService.updateMailPreferences(receive).subscribe({
      next: (answer) => {
        this.savingMailPref = false;
        if (answer.success) {
          this.receiveInfoMails = receive;
          this._notificationService.success(
            this._transloco.translate('account.mailPrefSaved')
          );
        }
      },
      error: () => {
        this.savingMailPref = false;
        this._notificationService.error(
          this._transloco.translate('account.mailPrefError')
        );
      },
    });
  }

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
