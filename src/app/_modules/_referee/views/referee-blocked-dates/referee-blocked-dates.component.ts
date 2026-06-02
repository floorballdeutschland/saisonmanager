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

interface CalendarDay {
  iso: string;
  day: number;
  past: boolean;
  blocked: boolean;
  blockedId: number | null;
  inRange: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
}

interface CalendarMonth {
  label: string;
  year: number;
  month: number;
  leadingEmpty: number;
  days: CalendarDay[];
}

@Component({
  templateUrl: './referee-blocked-dates.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefereeBlockedDatesComponent implements OnInit, OnDestroy {
  months: CalendarMonth[] = [];
  loading = true;
  saving = false;

  rangeStart: string | null = null;
  rangeHover: string | null = null;

  private _blockedMap = new Map<string, number>();
  private _destroy$ = new Subject<void>();

  private _today = new Date();
  private _todayIso = this._isoDate(this._today);

  constructor(
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const from = this._isoDate(new Date(now.getFullYear(), 0, 1));
    const to = this._isoDate(new Date(now.getFullYear() + 1, 11, 31));

    this._refereeService
      .getBlockedDates({ date_from: from, date_to: to })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (dates) => {
          this._blockedMap.clear();
          dates.forEach((d) => this._blockedMap.set(d.date, d.id));
          this._buildCalendar();
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

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  onDayClick(day: CalendarDay): void {
    if (day.past || this.saving) return;

    if (!this.rangeStart) {
      if (day.blocked && day.blockedId !== null) {
        this._deleteDate(day);
      } else {
        this.rangeStart = day.iso;
        this._rebuildDays();
      }
      return;
    }

    // Finish range selection
    const [start, end] =
      day.iso >= this.rangeStart
        ? [this.rangeStart, day.iso]
        : [day.iso, this.rangeStart];
    this.rangeStart = null;
    this.rangeHover = null;

    if (start === end) {
      this._createSingle(start);
    } else {
      this._createRange(start, end);
    }
  }

  onDayHover(day: CalendarDay): void {
    if (!this.rangeStart || day.past) return;
    this.rangeHover = day.iso;
    this._rebuildDays();
  }

  cancelRange(): void {
    this.rangeStart = null;
    this.rangeHover = null;
    this._rebuildDays();
  }

  private _deleteDate(day: CalendarDay): void {
    this.saving = true;
    this._refereeService
      .deleteBlockedDate(day.blockedId!)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._blockedMap.delete(day.iso);
          this.saving = false;
          this._rebuildDays();
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this._cdr.markForCheck();
          const msg =
            err?.error?.error || 'Fehler beim Entfernen des Sperrtermins.';
          this._notificationService.error(msg, {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  private _createSingle(iso: string): void {
    this.saving = true;
    this._refereeService
      .createBlockedDate(iso)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (d) => {
          this._blockedMap.set(d.date, d.id);
          this.saving = false;
          this._rebuildDays();
          this._cdr.markForCheck();
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

  private _createRange(start: string, end: string): void {
    const dates: string[] = [];
    const cur = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    while (cur <= endDate) {
      const iso = this._isoDate(cur);
      if (!this._blockedMap.has(iso)) dates.push(iso);
      cur.setDate(cur.getDate() + 1);
    }

    if (!dates.length) return;

    this.saving = true;
    this._refereeService
      .createBlockedDatesBulk(dates)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          result.created.forEach((d) => this._blockedMap.set(d.date, d.id));
          this.saving = false;
          this._rebuildDays();
          this._cdr.markForCheck();
          if (result.skipped.length) {
            this._notificationService.error(
              `${result.created.length} gespeichert, ${result.skipped.length} übersprungen.`,
              { autoClose: true, keepAfterRouteChange: false }
            );
          }
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

  private _buildCalendar(): void {
    const now = new Date();
    const months: CalendarMonth[] = [];
    for (let y = now.getFullYear(); y <= now.getFullYear() + 1; y++) {
      for (let m = 0; m < 12; m++) {
        months.push(this._buildMonth(y, m));
      }
    }
    this.months = months;
  }

  private _rebuildDays(): void {
    this.months = this.months.map((month) => ({
      ...month,
      days: month.days.map((d) => this._enrichDay(d.iso, d.day, d.past)),
    }));
    this._cdr.markForCheck();
  }

  private _buildMonth(year: number, month: number): CalendarMonth {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    // Monday-first: Sun=0 → 6, Mon=1 → 0, …
    const leadingEmpty = (firstDow + 6) % 7;

    const days: CalendarDay[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(
        d
      ).padStart(2, '0')}`;
      const past = iso <= this._todayIso;
      days.push(this._enrichDay(iso, d, past));
    }

    const monthNames = [
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember',
    ];
    return {
      label: `${monthNames[month]} ${year}`,
      year,
      month,
      leadingEmpty,
      days,
    };
  }

  private _enrichDay(iso: string, day: number, past: boolean): CalendarDay {
    const blocked = this._blockedMap.has(iso);
    const blockedId = this._blockedMap.get(iso) ?? null;

    let inRange = false;
    let rangeStart = false;
    let rangeEnd = false;

    if (this.rangeStart && !past) {
      const anchor = this.rangeStart;
      const hover = this.rangeHover ?? anchor;
      const [lo, hi] = anchor <= hover ? [anchor, hover] : [hover, anchor];
      inRange = iso >= lo && iso <= hi;
      rangeStart = iso === lo;
      rangeEnd = iso === hi;
    }

    return {
      iso,
      day,
      past,
      blocked,
      blockedId,
      inRange,
      rangeStart,
      rangeEnd,
    };
  }

  private _isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
