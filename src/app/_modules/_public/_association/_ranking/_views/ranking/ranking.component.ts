import {
  Component,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { Observable, shareReplay, Subject, take, takeUntil, tap } from 'rxjs';
import { GameScheduleEntry, League, TableEntry } from '@floorball/types';
import { LeagueService } from '@floorball/core';
import { Title } from '@angular/platform-browser';

@Component({
  templateUrl: './ranking.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingComponent implements OnInit, OnDestroy {
  teamRankings$?: Observable<TableEntry[] | null>;
  matches$?: Observable<GameScheduleEntry[] | null>;
  selectedLeague$!: Observable<League | null>;

  selectedMatchDay: { game_day_number: number; title: string } | null = null;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {}

  ngOnInit(): void {
    this.selectedLeague$ = this._leagueService.selectedLeague$;

    this.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this._metaTitle.setTitle(
              `${league.name} - Tabelle | SaisonManager`
            );
            this.getTeamRanking(league.id);
            this.getMatches(league);
            this.selectedMatchDay = league.game_day_titles[0];
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

  getMatches(league: League) {
    this.matches$ = this._leagueService
      .getGameScheduleForCurrentGameDay(league.id)
      .pipe(shareReplay());

    this.matches$
      .pipe(
        take(1),
        tap((games) => {
          if (!games) {
            return;
          }
          this.selectedMatchDay =
            league.game_day_titles.find(
              (_item) => _item.game_day_number === games[0].game_day
            ) ?? league.game_day_titles[0];
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  selectMatchDay(matchDay: number, league: League) {
    this.selectedMatchDay =
      league.game_day_titles.find(
        (_item) => _item.game_day_number === matchDay
      ) ?? null;

    this.matches$ = this._leagueService
      .getGameScheduleForGameDay(league.id, matchDay)
      .pipe(shareReplay());
  }
}
