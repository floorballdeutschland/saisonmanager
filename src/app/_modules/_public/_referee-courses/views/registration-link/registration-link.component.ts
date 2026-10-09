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
import { PublicRegistrationLinkInfo } from '@floorball/types';

/**
 * Bestätigen oder Abmelden über den Link aus der Mail. Das Laden ändert nichts,
 * weil Mailprogramme Links vorab abrufen; erst der Knopf handelt.
 */
@Component({
  templateUrl: './registration-link.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RegistrationLinkComponent implements OnInit, OnDestroy {
  kind: 'confirm' | 'cancel' = 'confirm';
  info: PublicRegistrationLinkInfo | null = null;
  state: 'loading' | 'open' | 'done' | 'invalid' | 'failed' = 'loading';
  failedSubmit = false;
  resultStatus: string | null = null;
  lateCancellation = false;
  busy = false;

  private _token = '';
  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseSignupService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.kind =
      this._route.snapshot.data['kind'] === 'cancel' ? 'cancel' : 'confirm';
    this._token = this._route.snapshot.paramMap.get('token') ?? '';
    this._service
      .registrationLink(this.kind, this._token)
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

  submit(): void {
    if (this.busy) return;
    this.busy = true;
    this._service
      .submitRegistrationLink(this.kind, this._token)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.busy = false;
          this.resultStatus = res.status;
          this.lateCancellation = !!res.late_cancellation;
          this.state = 'done';
          this._cdr.markForCheck();
        },
        // Nur 404/422 heißt „Link ungültig“; sonst bleibt der Knopf zum
        // erneuten Versuch stehen.
        error: (err: { status?: number }) => {
          this.busy = false;
          if (isInvalidLink(err)) this.state = 'invalid';
          else this.failedSubmit = true;
          this._cdr.markForCheck();
        },
      });
  }
}

function isInvalidLink(err: { status?: number }): boolean {
  return err?.status === 404 || err?.status === 422 || err?.status === 410;
}
