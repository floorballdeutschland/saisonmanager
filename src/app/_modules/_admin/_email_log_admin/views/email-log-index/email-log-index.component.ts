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
import { EmailLogService, NotificationService } from '@floorball/core';
import { EmailLog } from '@floorball/types';

@Component({
  templateUrl: './email-log-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
            'E-Mail-Log konnte nicht geladen werden.',
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
            `Testmail an ${this.testRecipient} versendet.`,
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
              ? `Testmail konnte nicht versendet werden: ${detail}`
              : 'Testmail konnte nicht versendet werden.',
            { autoClose: false }
          );
          this.sendingTest = false;
          this._cdr.markForCheck();
        },
      });
  }
}
