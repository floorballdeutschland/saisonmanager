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
import { RefereeFeedbackReportService, SessionService } from '@floorball/core';
import {
  RefereeFeedbackDistributionBands,
  RefereeFeedbackReport,
  RefereeFeedbackReportQuery,
  RefereeFeedbackReportReferee,
  RefereeFeedbackReportTimePoint,
  RefereeTag,
  User,
} from '@floorball/types';

type SortKey =
  | 'referee_name'
  | 'count'
  | 'avg_line_rating'
  | 'avg_communication_rating';

@Component({
  templateUrl: './referee-feedback-report-index.component.html',
  styleUrls: ['./referee-feedback-report-index.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeFeedbackReportIndexComponent implements OnInit, OnDestroy {
  loading = false;
  loadError: string | null = null;
  exporting = false;
  currentUser: User | null = null;

  data: RefereeFeedbackReport | null = null;
  tags: RefereeTag[] = [];

  // Filter-Bindings (client-getrieben, per „Anwenden" nachgeladen).
  filterTagId: number | null = null;
  filterResult: 'won' | 'lost' | '' = '';
  filterFrom = '';
  filterTo = '';
  filterMinCount = 3;
  filterSeasonId = '';
  filterLeagueId: number | null = null;

  // Bänder der Verteilung, in fester Reihenfolge.
  readonly bands: Array<keyof RefereeFeedbackDistributionBands> = [
    '1-2',
    '3-4',
    '5-6',
    '7-8',
    '9-10',
  ];

  sortKey: SortKey = 'count';
  sortDir: 'asc' | 'desc' = 'desc';

  private _destroy$ = new Subject<void>();

  constructor(
    private _reportService: RefereeFeedbackReportService,
    private _sessionService: SessionService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this._cdr.markForCheck();
      });

    this._reportService
      .getTags()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (tags) => {
          this.tags = tags;
          this._cdr.markForCheck();
        },
        error: () => {
          // Tags sind optional; Fehler nicht blockierend.
        },
      });

    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  private _buildQuery(): RefereeFeedbackReportQuery {
    const query: RefereeFeedbackReportQuery = {};
    if (this.filterSeasonId.trim())
      query.season_id = this.filterSeasonId.trim();
    if (this.filterLeagueId != null) query.league_id = this.filterLeagueId;
    if (this.filterTagId != null) query.tag_id = this.filterTagId;
    if (this.filterFrom) query.from = this.filterFrom;
    if (this.filterTo) query.to = this.filterTo;
    if (this.filterResult) query.result = this.filterResult;
    if (this.filterMinCount != null) query.min_count = this.filterMinCount;
    return query;
  }

  load(): void {
    this.loading = true;
    this.loadError = null;
    this._reportService
      .getAnalytics(this._buildQuery())
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.data = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          console.error(
            '[RefereeFeedbackReportIndexComponent] Laden fehlgeschlagen',
            err
          );
          this.loadError = this._transloco.translate(
            'refereeFeedbackReport.index.loadError'
          );
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  apply(): void {
    this.load();
  }

  // ----- Referee-Tabelle -----

  setSort(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = key === 'referee_name' ? 'asc' : 'desc';
    }
  }

  get referees(): RefereeFeedbackReportReferee[] {
    const rows = [...(this.data?.referees ?? [])];
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const key = this.sortKey;
    rows.sort((a, b) => {
      if (key === 'referee_name') {
        return a.referee_name.localeCompare(b.referee_name) * dir;
      }
      const av = a[key];
      const bv = b[key];
      // null-Werte immer ans Ende.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
    return rows;
  }

  // ----- Verteilung -----

  distributionMax(bands: RefereeFeedbackDistributionBands): number {
    return Math.max(...this.bands.map((b) => bands[b]), 1);
  }

  distributionHeight(
    bands: RefereeFeedbackDistributionBands,
    band: keyof RefereeFeedbackDistributionBands
  ): number {
    return (bands[band] / this.distributionMax(bands)) * 100;
  }

  // ----- Zeitreihe (avg_line_rating auf 0-10 skaliert) -----

  get timeSeriesOverall(): RefereeFeedbackReportTimePoint[] {
    return this.data?.time_series?.overall ?? [];
  }

  get timeSeriesGroup(): RefereeFeedbackReportTimePoint[] {
    return this.data?.time_series?.group ?? [];
  }

  ratingHeight(rating: number | null): number {
    if (rating == null) return 0;
    return (rating / 10) * 100;
  }

  formatPeriod(period: string): string {
    const [year, month] = period.split('-');
    if (!year || !month) return period;
    const name = this._transloco.translate(
      `refereeFeedbackReport.months.${parseInt(month, 10)}`
    );
    return `${name} ${year.slice(2)}`;
  }

  // ----- Export -----

  private _download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  exportCsv(): void {
    this.exporting = true;
    this._reportService
      .exportCsv(this._buildQuery())
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (blob) => {
          this._download(blob, 'schiri-feedback-auswertung.csv');
          this.exporting = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.exporting = false;
          this._cdr.markForCheck();
        },
      });
  }

  exportXlsx(): void {
    this.exporting = true;
    this._reportService
      .exportXlsx(this._buildQuery())
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (blob) => {
          this._download(blob, 'schiri-feedback-auswertung.xlsx');
          this.exporting = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.exporting = false;
          this._cdr.markForCheck();
        },
      });
  }
}
