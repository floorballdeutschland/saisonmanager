import {
  Component,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { Observable, Subject, take, takeUntil, tap } from 'rxjs';
import { GameScheduleEntry, League, TableEntry } from '@floorball/types';
import { LeagueService } from '@floorball/core';

@Component({
  templateUrl: './ranking.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingComponent implements OnInit, OnDestroy {
  teamRankings$?: Observable<TableEntry[] | null>;
  matches$?: Observable<GameScheduleEntry[] | null>;
  selectedLeague$!: Observable<League | null>;

  selectedMatchDay = 1;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.selectedLeague$ = this._leagueService.selectedLeague$;

    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this.getTeamRanking(league.id);
            this.getMatches(league.id);
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

  getTeamRanking(leagueNumber: number) {
    this.teamRankings$ = this._leagueService.getTable(leagueNumber);
  }

  getMatches(leagueNumber: number) {
    this.matches$ =
      this._leagueService.getGameScheduleForCurrentGameDay(leagueNumber);

    this._leagueService
      .getGameScheduleForCurrentGameDay(leagueNumber)
      .pipe(
        take(1),
        tap((games) => {
          this.selectedMatchDay = games[0].game_day;
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  selectMatchDay(matchDay: number, leagueNumber: number) {
    this.selectedMatchDay = matchDay;

    this.matches$ = this._leagueService.getGameScheduleForGameDay(
      leagueNumber,
      matchDay
    );
  }
}
