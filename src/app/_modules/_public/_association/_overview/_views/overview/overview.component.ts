import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { AssociationService, LeagueService } from '@floorball/core';
import {
  GameOperation,
  GameScheduleEntry,
  League,
  ScorerEntry,
  TableEntry,
} from '@floorball/types';
import {
  interval,
  Observable,
  shareReplay,
  Subject,
  take,
  takeUntil,
  tap,
} from 'rxjs';

@Component({
  templateUrl: './overview.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewComponent implements OnInit, OnDestroy {
  selectedAssociation$!: Observable<GameOperation | null>;
  selectedLeague$!: Observable<League | null>;
  singleLeague$!: Observable<League | null>;
  teamRankings$?: Observable<TableEntry[] | null>;
  playerRankings$?: Observable<ScorerEntry[] | null>;
  matches$?: Observable<GameScheduleEntry[] | null>;

  selectedMatchDay: { game_day_number: number; title: string } | null = null;
  maxGamedayNumber = 0;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {}

  ngOnInit(): void {
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this.selectedLeague$ = this._leagueService.selectedLeague$;
    this._associationService.selectAssociation(this._route);
    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this.getTeamRanking(league.id);
            this.getPlayerRanking(league.id);
            this.getSingleLeague(league.id);
            this.getMatches(league);
            this.selectedMatchDay = league.game_day_titles[0];

            this.maxGamedayNumber = league.game_day_titles.reduce(
              (max, item) => Math.max(max, item.game_day_number),
              0
            );

            this._metaTitle.setTitle(
              `${league.name} - Übersicht | Floorball Saisonmanager`
            );

            interval(30000)
              .pipe(
                tap(() => this.getMatches(league)),
                takeUntil(this._destroy$)
              )
              .subscribe();

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

  getPlayerRanking(leagueNumber: number) {
    this.playerRankings$ = this._leagueService.getScorer(leagueNumber);
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

  getSingleLeague(leagueNumber: number) {
    this.singleLeague$ = this._leagueService.getSingleLeague(leagueNumber);
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
