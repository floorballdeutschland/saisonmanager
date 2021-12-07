import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AssociationService,
  FavoriteService,
  LeagueService,
} from '@floorball/core';
import { GameOperation, GameScheduleEntry, League } from '@floorball/types';
import { BehaviorSubject, Observable, Subject, takeUntil, tap } from 'rxjs';

@Component({
  templateUrl: './league-host.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeagueHostComponent implements OnInit, OnDestroy {
  selectedLeague$!: Observable<League | null>;
  selectedAssociation$!: Observable<GameOperation | null>;
  matches$?: Observable<GameScheduleEntry[] | null>;
  displayAssociationHeader$!: BehaviorSubject<boolean>;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _leagueService: LeagueService,
    private _associationService: AssociationService,
    private _route: ActivatedRoute,
    private _favoriteService: FavoriteService
  ) {}

  ngOnDestroy(): void {
    this._leagueService.clearLeague();
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
    this.displayAssociationHeader$ =
      this._associationService.displayAssociationHeader$;
    this.selectedLeague$ = this._leagueService.selectedLeague$;
    this.selectedAssociation$ = this._associationService.selectedAssociation$;

    this._route.params
      .pipe(
        tap(() => {
          this._leagueService.selectLeague(this._route);
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();

    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this.getMatches(league.id);
          }
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  addToFavorites(league: League): void {
    this._favoriteService.addToFavorites(league);
  }

  removeFavorite(leagueId: number) {
    this._favoriteService.removeFavorite(leagueId);
  }

  isLeagueFavorite(leagueId: number): boolean {
    return this._favoriteService.isLeagueFavorite(leagueId);
  }

  getMatches(leagueNumber: number) {
    this.matches$ =
      this._leagueService.getGameScheduleForCurrentGameDay(leagueNumber);
  }
}
