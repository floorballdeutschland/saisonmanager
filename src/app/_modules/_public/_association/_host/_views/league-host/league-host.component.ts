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
  StorageService,
} from '@floorball/core';
import { GameOperation, League } from '@floorball/types';
import { Observable, Subject, takeUntil, tap } from 'rxjs';

@Component({
  templateUrl: './league-host.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeagueHostComponent implements OnInit, OnDestroy {
  selectedLeague$!: Observable<League | null>;
  selectedAssociation$!: Observable<GameOperation | null>;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _leagueService: LeagueService,
    private _associationService: AssociationService,
    private _route: ActivatedRoute,
    private _storageService: StorageService,
    private _favoriteService: FavoriteService
  ) {}

  ngOnDestroy(): void {
    this._leagueService.clearLeague();
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
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
  }

  addToFavorites(league: League): void {
    this._favoriteService.addToFavorites(league);
  }
}
