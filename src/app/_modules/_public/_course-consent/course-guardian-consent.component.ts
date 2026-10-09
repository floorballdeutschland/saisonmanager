import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { RefereeCourseSignupService } from '@floorball/core';
import { GuardianConsentInfo } from '@floorball/types';

/**
 * Einwilligung der Erziehungsberechtigten zu einer Kursanmeldung (unter 16).
 * Ohne Login, der Link aus der Mail ist die Berechtigung. Das Laden ändert
 * nichts; erst der Knopf willigt ein.
 */
@Component({
  templateUrl: './course-guardian-consent.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseGuardianConsentComponent implements OnInit, OnDestroy {
  info: GuardianConsentInfo | null = null;
  state: 'loading' | 'open' | 'done' | 'invalid' | 'failed' = 'loading';
  resultStatus: string | null = null;
  busy = false;
  failedSubmit = false;

  private _token = '';
  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseSignupService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._token = this._route.snapshot.paramMap.get('token') ?? '';
    this._service
      .guardianConsent(this._token)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (info) => {
          this.info = info;
          this.state = 'open';
          this._cdr.markForCheck();
        },
        error: (err: { status?: number }) => {
          this.state = isInvalidLink(err) ? 'invalid' : 'failed';
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  confirm(): void {
    if (this.busy) return;
    this.busy = true;
    this._service
      .confirmGuardianConsent(this._token)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.busy = false;
          this.resultStatus = res.status;
          this.state = 'done';
          this._cdr.markForCheck();
        },
        // Nur 404/422 heißt „Link ungültig“. Ein Netzwerk- oder Serverfehler
        // lässt den Knopf stehen, der Link gilt ja weiter.
        error: (err: { status?: number }) => {
          this.busy = false;
          if (isInvalidLink(err)) this.state = 'invalid';
          else this.failedSubmit = true;
          this._cdr.markForCheck();
        },
      });
  }
}

/** Der Link selbst taugt nicht mehr (unbekannt, abgelaufen, schon benutzt). */
export function isInvalidLink(err: { status?: number }): boolean {
  return err?.status === 404 || err?.status === 422 || err?.status === 410;
}
