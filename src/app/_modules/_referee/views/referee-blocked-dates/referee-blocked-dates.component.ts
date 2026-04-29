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
import { RefereeBlockedDate } from '@floorball/types';

@Component({
  templateUrl: './referee-blocked-dates.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefereeBlockedDatesComponent implements OnInit, OnDestroy {
  dates: RefereeBlockedDate[] = [];
  loading = true;
  saving = false;
  newDate = '';
  deletingId: number | null = null;
  today = new Date().toISOString().slice(0, 10);

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  addDate(): void {
    if (!this.newDate) return;
    this.saving = true;
    this._refereeService
      .createBlockedDate(this.newDate)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (d) => {
          this.dates = [...this.dates, d].sort((a, b) =>
            a.date.localeCompare(b.date)
          );
          this.newDate = '';
          this.saving = false;
          this._cdr.markForCheck();
          this._notificationService.success('Sperrtermin gespeichert.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
        },
        error: (err) => {
          this.saving = false;
          this._cdr.markForCheck();
          const msg = err?.error?.errors?.[0] || 'Fehler beim Speichern.';
          this._notificationService.error(msg, {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  deleteDate(id: number): void {
    this.deletingId = id;
    this._refereeService
      .deleteBlockedDate(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.dates = this.dates.filter((d) => d.id !== id);
          this.deletingId = null;
          this._cdr.markForCheck();
          this._notificationService.success('Sperrtermin entfernt.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
        },
        error: (err) => {
          this.deletingId = null;
          this._cdr.markForCheck();
          const msg = err?.error?.error || 'Fehler beim Löschen.';
          this._notificationService.error(msg, {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private _load(): void {
    this.loading = true;
    this._refereeService
      .getBlockedDates()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (dates) => {
          this.dates = dates;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            'Sperrtermine konnten nicht geladen werden.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        },
      });
  }
}
