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
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import {
  AssociationService,
  FavoriteService,
  LeagueService,
  NotificationService,
  SessionService,
  StorageService,
  SystemHealthService,
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
  catchError,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { environment } from 'src/environments/environment';

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
  styleUrls: ['./app.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AppComponent implements OnInit {
  isLoading$!: Observable<boolean>;
  leagues$!: Observable<League[] | null>;
  associations$!: Observable<GameOperation[]>;
  // Nur auf der Startseite UND nur für nicht eingeloggte Besucher sollen die
  // Spielbetriebe im Seitenmenü erscheinen – eingeloggte Nutzer (z.B.
  // Schiedsrichter) sehen dort stattdessen ihre eigene Navigation.
  isHome$!: Observable<boolean>;
  selectedAssociation$!: Observable<GameOperation | null>;
  selectedStateAssociation$!: Observable<StateAssociation | null>;
  seasons$!: Observable<Season[]>;
  selectedSeasonId$!: Observable<number>;

  favoriteLeagues$?: BehaviorSubject<LeaguesWithOperation[]>;
  favoriteTeams$?: BehaviorSubject<FavoriteTeam[]>;

  // Auf dem Staging-System (saisonmanager.dev) eine dauerhaft sichtbare
  // Kennzeichnung einblenden, damit Testsystem und Produktion nicht
  // verwechselt werden. Wird über die Build-Konfiguration gesetzt.
  readonly isStaging = environment.staging;

  // Belegung des Servers, sobald sie kritisch ist. Nur Admins fragen sie ab
  // (Recht menu_item_system_health), und nur im kritischen Zustand entsteht ein
  // Streifen. Absichtlich der schlanke summary-Aufruf: Die Aufschlüsselungen der
  // Systemseite werden dafür nicht gebraucht.
  criticalDiskPercent$!: Observable<number | null>;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _storageService: StorageService,
    private _favoriteService: FavoriteService,
    private _router: Router,
    private _notificationService: NotificationService,
    private _sessionService: SessionService,
    private _systemHealthService: SystemHealthService,
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
            (event) =>
              event instanceof NavigationError &&
              LAZY_LOAD_ERROR.test(String(event.error?.message ?? event.error))
          )
        )
        .subscribe(() => {
          // keepAfterRouteChange bewusst nicht gesetzt: NavigationStart feuert
          // vor NavigationError, die Meldung entsteht also erst NACH dem
          // Aufräumen der eigenen Navigation. So bleibt sie auf der hängenden
          // Seite stehen, wird aber bei der nächsten (erfolgreichen)
          // Navigation entfernt und stapelt sich bei Retries nicht.
          this._notificationService.error(
            'Die Seite konnte nicht geladen werden. Bitte prüfe deine Internetverbindung und lade die Seite neu.',
            { autoClose: false }
          );
        });
    }

    this.isLoading$ = this._associationService.associationsIsLoading$;
    this.leagues$ = this._leagueService.leagues$;
    this.associations$ = this._associationService.associations$;
    this.isHome$ = combineLatest([
      this._router.events.pipe(
        filter((event) => event instanceof NavigationEnd),
        map((event) =>
          this._isHomeUrl((event as NavigationEnd).urlAfterRedirects)
        ),
        startWith(this._isHomeUrl(this._router.url))
      ),
      this._sessionService.isLoggedIn$,
    ]).pipe(map(([isHome, isLoggedIn]) => isHome && !isLoggedIn));
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this.selectedStateAssociation$ =
      this._associationService.selectedStateAssociation$;
    this.seasons$ = this._associationService.seasons$;
    this.selectedSeasonId$ = this._associationService.currentSeasonId$;
    this.favoriteLeagues$ = this._favoriteService.favoriteLeagues$;
    this.favoriteTeams$ = this._favoriteService.favoriteTeams$;
    // Nur das eine Recht auswerten und Wiederholungen abschneiden:
    // currentUser$ ist ein ReplaySubject und feuert auch bei einer Namens- oder
    // E-Mail-Änderung. Ohne distinctUntilChanged würde jede dieser Meldungen den
    // Abruf erneut anstoßen, und ein spät hinzukommender Abnehmer bekäme den
    // gepufferten Verlauf nachgespielt.
    this.criticalDiskPercent$ = this._sessionService.currentUser$.pipe(
      map((user) => !!user?.permissions?.['menu_item_system_health']),
      distinctUntilChanged(),
      switchMap((maySeeSystemHealth) => {
        if (!maySeeSystemHealth) return of(null);
        return this._systemHealthService.getSummary().pipe(
          map((summary) =>
            summary.status === 'critical' ? summary.used_percent : null
          ),
          // Der Streifen ist ein Zusatz. Scheitert der Abruf, bleibt die App
          // still statt eine Fehlermeldung über jede Seite zu legen.
          catchError(() => of(null))
        );
      })
    );
  }

  private _isHomeUrl(url: string): boolean {
    const path = url.split(/[?#]/)[0];
    return path === '/' || path === '';
  }

  onSeasonChange(seasonId: number): void {
    this._leagueService.changeSeason(seasonId);
  }

  removeFavoriteLeague(id: number): void {
    this._favoriteService.removeFavorite(id);
  }

  removeFavoriteTeam(id: number): void {
    this._favoriteService.removeTeamFavorite(id);
  }
}
