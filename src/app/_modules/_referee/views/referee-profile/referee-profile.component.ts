import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
import { RefereeProfile } from '@floorball/types';

@Component({
  templateUrl: './referee-profile.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
          this.draft = { ...p };
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            'Profil konnte nicht geladen werden.',
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

  submit(): void {
    if (!this.draft.vorname || !this.draft.nachname) return;
    this.saving = true;
    this._refereeService
      .updateProfile(this.draft)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (p) => {
          this.profile = p;
          this.draft = { ...p };
          this.saving = false;
          this._cdr.markForCheck();
          this._notificationService.success('Profil gespeichert.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
        },
        error: () => {
          this.saving = false;
          this._cdr.markForCheck();
          this._notificationService.error('Fehler beim Speichern.', {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }
}
