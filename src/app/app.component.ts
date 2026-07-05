import { isPlatformBrowser, registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnInit,
  PLATFORM_ID,
  ViewEncapsulation,
} from '@angular/core';
import { NavigationError, Router } from '@angular/router';
import {
  AssociationService,
  FavoriteService,
  LeagueService,
  NotificationService,
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
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
} from 'rxjs';

// Fehlermeldungen der Browser, wenn ein lazy geladenes Routen-Modul nicht
// nachgeladen werden kann (Verbindungsabriss oder nach einem Deploy entfernte
// Chunk-Datei): Chrome/Firefox/Safari formulieren jeweils anders.
const LAZY_LOAD_ERROR =
  /dynamically imported module|Importing a module script failed|Loading chunk/i;

registerLocaleData(localeDe);
registerLocaleData(localeEn);

@Component({
  selector: 'fb-root',
  templateUrl: './app.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
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
    private _favoriteService: FavoriteService,
    private _router: Router,
    private _notificationService: NotificationService,
    @Inject(PLATFORM_ID) private _platformId: object
  ) {}

  ngOnInit(): void {
    // Scheitert das Nachladen eines lazy Routen-Moduls, bricht der Router die
    // Navigation kommentarlos ab und die alte Ansicht bleibt stehen. Ohne
    // Hinweis wirkt die App dann "tot" – daher hier eine sichtbare Meldung.
    if (isPlatformBrowser(this._platformId)) {
      this._router.events
        .pipe(
          filter(
            (event): event is NavigationError =>
              event instanceof NavigationError &&
              LAZY_LOAD_ERROR.test(String(event.error?.message ?? event.error))
          )
        )
        .subscribe(() => {
          this._notificationService.error(
            'Die Seite konnte nicht geladen werden. Bitte prüfe deine Internetverbindung und lade die Seite neu.',
            { autoClose: false, keepAfterRouteChange: true }
          );
        });
    }

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
