import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  AssociationService,
  FavoriteService,
  LeagueService,
  StorageService,
} from '@floorball/core';
import {
  FavoriteTeam,
  GameOperation,
  League,
  LeaguesWithOperation,
  Season,
  StateAssociation,
} from '@floorball/types';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';

registerLocaleData(localeDe);

@Component({
  selector: 'fb-root',
  templateUrl: './app.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  isLoading$!: Observable<boolean>;
  leagues$!: Observable<League[] | null>;
  selectedAssociation$!: Observable<GameOperation | null>;
  selectedStateAssociation$!: Observable<StateAssociation | null>;
  activeBanner$!: Observable<{ url: string; linkUrl?: string | null } | null>;
  seasons$!: Observable<Season[]>;
  selectedSeasonId$!: Observable<number>;

  favoriteLeagues$?: BehaviorSubject<LeaguesWithOperation[]>;
  favoriteTeams$?: BehaviorSubject<FavoriteTeam[]>;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _storageService: StorageService,
    private _favoriteService: FavoriteService
  ) {}

  ngOnInit(): void {
    this.isLoading$ = this._associationService.associationsIsLoading$;
    this.leagues$ = this._leagueService.leagues$;
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this.selectedStateAssociation$ =
      this._associationService.selectedStateAssociation$;
    this.seasons$ = this._associationService.seasons$;
    this.selectedSeasonId$ = this._associationService.currentSeasonId$;
    this.favoriteLeagues$ = this._favoriteService.favoriteLeagues$;
    this.favoriteTeams$ = this._favoriteService.favoriteTeams$;

    this.activeBanner$ = combineLatest([
      this._leagueService.selectedLeague$,
      this.selectedStateAssociation$,
    ]).pipe(
      map(([league, sa]) => {
        if (league?.banner_url) {
          return { url: league.banner_url, linkUrl: league.banner_link_url };
        }
        if (sa?.banner_url) {
          return { url: sa.banner_url, linkUrl: sa.banner_link_url };
        }
        return null;
      })
    );
  }

  onSeasonChange(seasonId: number): void {
    this._associationService.selectSeason(seasonId);
  }

  removeFavoriteLeague(id: number): void {
    this._favoriteService.removeFavorite(id);
  }

  removeFavoriteTeam(id: number): void {
    this._favoriteService.removeTeamFavorite(id);
  }
}
