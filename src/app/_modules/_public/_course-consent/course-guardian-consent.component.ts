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
  state: 'loading' | 'open' | 'done' | 'invalid' = 'loading';
  resultStatus: string | null = null;
  busy = false;

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
        error: () => {
          this.state = 'invalid';
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
        error: () => {
          this.busy = false;
          this.state = 'invalid';
          this._cdr.markForCheck();
        },
      });
  }
}
