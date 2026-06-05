import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Observable, Subject, takeUntil, tap } from 'rxjs';
import { ScorerEntry } from '@floorball/types';
import { LeagueService } from '@floorball/core';
import { Title } from '@angular/platform-browser';

@Component({
  templateUrl: './scorer.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ScorerComponent implements OnInit, OnDestroy {
  playerRankings$?: Observable<ScorerEntry[] | null>;

  currentPage = 1;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {}

  ngOnInit(): void {
    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this._metaTitle.setTitle(`${league.name} - Scorer | SaisonManager`);
            this.getPlayerRanking(league.id);
            this._cdr.markForCheck();
          }
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  getPlayerRanking(leagueNumber: number) {
    this.playerRankings$ = this._leagueService.getScorer(leagueNumber);
  }

  changePage(page: number) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.currentPage = page;
  }

  getPages(arrayLength: number): number {
    return Math.ceil(arrayLength / 30);
  }
}
