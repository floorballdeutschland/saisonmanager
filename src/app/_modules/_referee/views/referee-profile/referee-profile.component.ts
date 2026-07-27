import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { NotificationService, RefereeService } from '@floorball/core';
import { RefereeProfile } from '@floorball/types';

@Component({
  templateUrl: './referee-profile.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeProfileComponent implements OnInit, OnDestroy {
  profile?: RefereeProfile;
  draft: Partial<RefereeProfile> = {};
  loading = false;
  saving = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this._refereeService
      .getProfile()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (p) => {
          this.profile = p;
          this.draft = this._toDraft(p);
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate(
              'refereeSelf.notifications.profileLoadError'
            ),
            {
              autoClose: false,
              keepAfterRouteChange: false,
            }
          );
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  /**
   * Weicht der Schiri-Name vom Namen des Benutzerkontos ab? Bei Altbeständen
   * möglich, weil die Spiegelung erst beim nächsten Speichern unter „Mein
   * Konto" greift (analog zur E-Mail-Divergenz).
   */
  get accountNameDiverged(): boolean {
    const accountName = this.profile?.account_name?.trim();
    if (!accountName) return false;

    const refereeName = [this.profile?.vorname, this.profile?.nachname]
      .filter(Boolean)
      .join(' ')
      .trim();

    return accountName !== refereeName;
  }

  // E-Mail und Name bleiben außen vor: Sie werden unter „Mein Konto" gepflegt
  // (E-Mail per Double-Opt-In) und sind hier nur noch read-only sichtbar; die
  // API ignoriert die Felder beim Speichern ohnehin.
  private _toDraft(p: RefereeProfile): Partial<RefereeProfile> {
    const draft: Partial<RefereeProfile> = { ...p };
    delete draft.email;
    delete draft.account_email;
    delete draft.vorname;
    delete draft.nachname;
    delete draft.account_name;
    return draft;
  }

  submit(): void {
    this.saving = true;
    this._refereeService
      .updateProfile(this.draft)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (p) => {
          this.profile = p;
          this.draft = this._toDraft(p);
          this.saving = false;
          this._cdr.markForCheck();
          this._notificationService.success(
            this._transloco.translate('refereeSelf.notifications.profileSaved'),
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
        error: () => {
          this.saving = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate(
              'refereeSelf.notifications.profileSaveError'
            ),
            {
              autoClose: false,
              keepAfterRouteChange: false,
            }
          );
        },
      });
  }
}
