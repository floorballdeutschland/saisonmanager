import {
  Component,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  OnDestroy,
  ChangeDetectorRef,
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
import { interval, Observable, Subject, takeUntil, tap } from 'rxjs';

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
            this.getMatches(league.id);

            this._metaTitle.setTitle(
              `${league.name} - Übersicht | Floorball Saisonmanager`
            );

            interval(30000)
              .pipe(
                tap(() => this.getMatches(league.id)),
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

  getMatches(leagueNumber: number) {
    this.matches$ =
      this._leagueService.getGameScheduleForCurrentGameDay(leagueNumber);
  }

  getSingleLeague(leagueNumber: number) {
    this.singleLeague$ = this._leagueService.getSingleLeague(leagueNumber);
  }
}
