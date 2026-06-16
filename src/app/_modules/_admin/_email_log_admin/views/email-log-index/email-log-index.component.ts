import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { EmailLogService, NotificationService } from '@floorball/core';
import { EmailLog } from '@floorball/types';

@Component({
  templateUrl: './email-log-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EmailLogIndexComponent implements OnInit, OnDestroy {
  logs: EmailLog[] = [];
  loading = false;
  testRecipient = '';
  sendingTest = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _emailLogService: EmailLogService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this._emailLogService
      .getAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.logs = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          console.error('EmailLog load failed', err);
          this.loading = false;
          this._notificationService.error(
            this._transloco.translate('emailLog.notifications.loadError'),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  sendTest(): void {
    if (!this.testRecipient.trim()) return;
    this.sendingTest = true;
    this._emailLogService
      .sendTest(this.testRecipient.trim())
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success(
            this._transloco.translate('emailLog.notifications.testSent', {
              recipient: this.testRecipient,
            }),
            { autoClose: true }
          );
          this.testRecipient = '';
          this.sendingTest = false;
          this._cdr.markForCheck();
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          console.error('sendTest failed', err);
          const detail =
            err.status === 422 || err.status === 503
              ? err.error?.error
              : undefined;
          this._notificationService.error(
            detail
              ? this._transloco.translate(
                  'emailLog.notifications.testErrorDetail',
                  { detail }
                )
              : this._transloco.translate('emailLog.notifications.testError'),
            { autoClose: false }
          );
          this.sendingTest = false;
          this._cdr.markForCheck();
        },
      });
  }
}
