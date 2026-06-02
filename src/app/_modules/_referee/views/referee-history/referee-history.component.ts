import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { RefereeService } from '@floorball/core';
import {
  RefereeHistorySeason,
  RefereeHistoryTestAttempt,
} from '@floorball/types';

@Component({
  templateUrl: './referee-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefereeHistoryComponent implements OnInit {
  seasons: RefereeHistorySeason[] = [];
  tests: RefereeHistoryTestAttempt[] = [];
  loadingGames = true;
  loadingTests = true;
  activeTab: 'games' | 'tests' = 'games';

  expandedSeasons = new Set<number>();

  constructor(
    private _refereeService: RefereeService,
    private _cdr: ChangeDetectorRef
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
}
