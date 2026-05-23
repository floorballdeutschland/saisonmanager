import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import {
  AnalyticsService,
  AnalyticsData,
  DailyCount,
  MonthlyCount,
} from '@floorball/core';

@Component({
  templateUrl: './analytics-index.component.html',
  styleUrls: ['./analytics-index.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsIndexComponent implements OnInit, OnDestroy {
  loading = false;
  data: AnalyticsData | null = null;

  private _destroy$ = new Subject<void>();

  constructor(
    private _analyticsService: AnalyticsService,
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
    this._analyticsService
      .getAnalytics()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.data = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  get total30Days(): number {
    return this.data?.last_30_days.reduce((s, d) => s + d.count, 0) ?? 0;
  }

  get currentMonthTotal(): number {
    if (!this.data) return 0;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}`;
    return (
      this.data.last_year.find((m) => m.month === currentMonth)?.count ?? 0
    );
  }

  get totalYear(): number {
    return this.data?.last_year.reduce((s, m) => s + m.count, 0) ?? 0;
  }

  get maxDaily(): number {
    if (!this.data?.last_30_days.length) return 1;
    return Math.max(...this.data.last_30_days.map((d) => d.count), 1);
  }

  get maxMonthly(): number {
    if (!this.data?.last_year.length) return 1;
    return Math.max(...this.data.last_year.map((m) => m.count), 1);
  }

  dailyHeight(count: number): number {
    return (count / this.maxDaily) * 100;
  }

  monthlyHeight(count: number): number {
    return (count / this.maxMonthly) * 100;
  }

  formatDay(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}.`;
  }

  formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-');
    const names = [
      'Jan',
      'Feb',
      'Mär',
      'Apr',
      'Mai',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Okt',
      'Nov',
      'Dez',
    ];
    return `${names[parseInt(month, 10) - 1]} ${year.slice(2)}`;
  }

  get last30Days(): DailyCount[] {
    return this.data?.last_30_days ?? [];
  }

  get lastYear(): MonthlyCount[] {
    return this.data?.last_year ?? [];
  }
}
