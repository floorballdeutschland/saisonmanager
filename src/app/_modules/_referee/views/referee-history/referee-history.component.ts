import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { RefereeService } from '@floorball/core';
import {
  RefereeCourseResultCourseData,
  RefereeCourseResultSummary,
  RefereeHistorySeason,
} from '@floorball/types';

@Component({
  templateUrl: './referee-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeHistoryComponent implements OnInit {
  seasons: RefereeHistorySeason[] = [];
  tests: RefereeCourseResultSummary[] = [];
  loadingGames = true;
  loadingTests = true;
  activeTab: 'games' | 'tests' = 'games';

  expandedSeasons = new Set<number>();

  constructor(
    private _refereeService: RefereeService,
    private _cdr: ChangeDetectorRef,
    private _transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    this._refereeService.getHistoryGames().subscribe({
      next: (seasons) => {
        this.seasons = seasons;
        if (seasons.length) this.expandedSeasons.add(seasons[0].season_id);
        this.loadingGames = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loadingGames = false;
        this._cdr.markForCheck();
      },
    });

    this._refereeService.getHistoryTests().subscribe({
      next: (tests) => {
        this.tests = tests;
        this.loadingTests = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loadingTests = false;
        this._cdr.markForCheck();
      },
    });
  }

  toggleSeason(seasonId: number): void {
    if (this.expandedSeasons.has(seasonId)) {
      this.expandedSeasons.delete(seasonId);
    } else {
      this.expandedSeasons.add(seasonId);
    }
  }

  formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  courseLine(data?: RefereeCourseResultCourseData): string | null {
    if (!data) return null;
    const parts: string[] = [];
    if (data.stufe) parts.push(data.stufe);
    if (data.datum) parts.push(data.datum);
    if (data.testversion) {
      parts.push(
        this._transloco.translate('refereeSelf.history.testversion', {
          version: data.testversion,
        })
      );
    }
    if (data.punkte) {
      parts.push(
        this._transloco.translate('refereeSelf.history.points', {
          points: data.punkte,
        })
      );
    }
    return parts.length ? parts.join(', ') : null;
  }
}
