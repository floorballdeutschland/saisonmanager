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
import { FeedbackCommentsService, NotificationService } from '@floorball/core';
import {
  FeedbackComment,
  FeedbackCommentsFilter,
  FeedbackTheme,
  FeedbackThemeStatEntry,
  FeedbackThemeStats,
  RefereeTag,
} from '@floorball/types';

interface TimeSeriesBar {
  period: string;
  total: number;
}

@Component({
  templateUrl: './feedback-comments-index.component.html',
  styleUrls: ['./feedback-comments-index.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FeedbackCommentsIndexComponent implements OnInit, OnDestroy {
  loading = false;
  loadError = false;
  comments: FeedbackComment[] = [];
  themes: FeedbackTheme[] = [];
  tags: RefereeTag[] = [];

  // Filter (an die Filterleiste via ngModel gebunden)
  filter: FeedbackCommentsFilter = {
    tag_id: null,
    theme_id: null,
    max_rating: null,
    from: null,
    to: null,
  };

  // Pagination (clientseitig)
  currentPage = 1;
  readonly pageSize = 20;

  // Themen-Auswertung
  showStats = false;
  statsLoading = false;
  stats: FeedbackThemeStats | null = null;

  // Verschlagwortung: welche Karte hat den Themen-Editor offen
  editingCommentId: number | null = null;
  savingThemesId: number | null = null;

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: FeedbackCommentsService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._service
      .getRefereeTags()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (tags) => {
          this.tags = tags;
          this._cdr.markForCheck();
        },
      });

    this._service
      .getThemes()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (themes) => {
          this.themes = themes;
          this._cdr.markForCheck();
        },
      });

    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  private _cleanFilter(): FeedbackCommentsFilter {
    // Leere Werte werden im Service ohnehin entfernt; max_rating als Zahl casten.
    return {
      ...this.filter,
      max_rating:
        this.filter.max_rating != null && `${this.filter.max_rating}` !== ''
          ? Number(this.filter.max_rating)
          : null,
    };
  }

  load(): void {
    this.loading = true;
    this.loadError = false;
    this._service
      .getComments(this._cleanFilter())
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (comments) => {
          this.comments = comments ?? [];
          this.currentPage = 1;
          this.editingCommentId = null;
          this.loading = false;
          this._cdr.markForCheck();
          if (this.showStats) this.loadStats();
        },
        error: () => {
          this.loadError = true;
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  apply(): void {
    this.load();
  }

  resetFilter(): void {
    this.filter = {
      tag_id: null,
      theme_id: null,
      max_rating: null,
      from: null,
      to: null,
    };
    this.load();
  }

  // ---- Pagination ----------------------------------------------------------

  get numberOfPages(): number {
    return Math.max(1, Math.ceil(this.comments.length / this.pageSize));
  }

  get pagedComments(): FeedbackComment[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.comments.slice(start, start + this.pageSize);
  }

  changePage(page: number): void {
    this.currentPage = page;
    this.editingCommentId = null;
    this._cdr.markForCheck();
  }

  // ---- Verschlagwortung ----------------------------------------------------

  toggleThemeEditor(comment: FeedbackComment): void {
    this.editingCommentId =
      this.editingCommentId === comment.id ? null : comment.id;
    this._cdr.markForCheck();
  }

  isThemeSelected(comment: FeedbackComment, themeId: number): boolean {
    return comment.themes.some((t) => t.id === themeId);
  }

  toggleTheme(comment: FeedbackComment, theme: FeedbackTheme): void {
    const current = comment.themes.map((t) => t.id);
    const next = current.includes(theme.id)
      ? current.filter((id) => id !== theme.id)
      : [...current, theme.id];
    this._saveThemes(comment, next);
  }

  private _saveThemes(comment: FeedbackComment, themeIds: number[]): void {
    this.savingThemesId = comment.id;
    this._cdr.markForCheck();
    this._service
      .setThemes(comment.id, themeIds)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.comments = this.comments.map((c) =>
            c.id === updated.id ? updated : c
          );
          this.savingThemesId = null;
          this._cdr.markForCheck();
          if (this.showStats) this.loadStats();
        },
        error: () => {
          this.savingThemesId = null;
          this._notificationService.error(
            this._transloco.translate(
              'feedbackComments.notifications.themeError'
            ),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  // ---- Themen-Auswertung ---------------------------------------------------

  toggleStats(): void {
    this.showStats = !this.showStats;
    if (this.showStats && !this.stats) this.loadStats();
    this._cdr.markForCheck();
  }

  loadStats(): void {
    this.statsLoading = true;
    this._service
      .getStats(this._cleanFilter())
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.statsLoading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.statsLoading = false;
          this._cdr.markForCheck();
        },
      });
  }

  get hasGroupFilter(): boolean {
    return this.filter.tag_id != null;
  }

  get statThemes(): FeedbackThemeStatEntry[] {
    return this.stats?.themes ?? [];
  }

  get maxThemeCount(): number {
    return Math.max(1, ...this.statThemes.map((t) => t.count));
  }

  themeBarWidth(count: number): number {
    return (count / this.maxThemeCount) * 100;
  }

  get timeSeriesBars(): TimeSeriesBar[] {
    return (this.stats?.time_series ?? []).map((entry) => ({
      period: entry.period,
      total: Object.values(entry.counts ?? {}).reduce(
        (sum, n) => sum + (n ?? 0),
        0
      ),
    }));
  }

  get maxTimeSeries(): number {
    return Math.max(1, ...this.timeSeriesBars.map((b) => b.total));
  }

  timeSeriesHeight(total: number): number {
    return (total / this.maxTimeSeries) * 100;
  }

  formatPeriod(period: string): string {
    const [year, month] = (period ?? '').split('-');
    if (!year || !month) return period;
    const name = this._transloco.translate(
      `feedbackComments.months.${parseInt(month, 10)}`
    );
    return `${name} ${year.slice(2)}`;
  }
}
