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

  // Name: frei änderbar. Der Benutzername wird nur angezeigt – er ist die
  // Login-Kennung und lässt sich ausschließlich in der Benutzerverwaltung ändern.
  userName = this._sessionService.currentUser?.username ?? '';
  firstName: string;
  lastName: string;
  savingName = false;
  // Schiri-Konten dürfen den Namen nicht selbst ändern: Er steht auf dem
  // digitalen Schiedsrichterausweis, über den es Vergünstigungen gibt. Die
  // Sperre setzt das Backend durch, hier wird nur die Eingabe ausgeblendet.
  canChangeName = !this._sessionService.currentUser?.referee_id;

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
  ) {
    // Konten, die schon vor dem Deploy eingeloggt waren, haben einen im
    // localStorage abgelegten User ohne first_name/last_name. Bis zum nächsten
    // Login den zusammengesetzten name aufteilen, damit das Formular nicht
    // leer startet und ein Tippfehler nicht die komplette Neueingabe erzwingt.
    const user = this._sessionService.currentUser;
    const [fallbackFirst = '', ...fallbackRest] = (user?.name ?? '')
      .trim()
      .split(/\s+/);
    this.firstName = user?.first_name ?? fallbackFirst;
    this.lastName = user?.last_name ?? fallbackRest.join(' ');
  }

  public submitName() {
    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();

    if (!firstName || !lastName) {
      this._notificationService.error(
        this._transloco.translate('account.nameMissing')
      );
      return;
    }

    this.savingName = true;
    this._sessionService.updateName(firstName, lastName).subscribe({
      next: (answer) => {
        this.savingName = false;
        if (answer.success) {
          this.firstName = answer.user.first_name ?? firstName;
          this.lastName = answer.user.last_name ?? lastName;
          this._notificationService.success(
            this._transloco.translate('account.nameSaved')
          );
        }
        this._cdr.markForCheck();
      },
      // Die Server-Meldung (422) zeigt bereits der ErrorInterceptor als
      // Notification – hier nur aufräumen, sonst gäbe es einen zweiten Toast.
      error: () => {
        this.savingName = false;
        this._cdr.markForCheck();
      },
    });
  }

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
