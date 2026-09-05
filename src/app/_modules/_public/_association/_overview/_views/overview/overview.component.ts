import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewEncapsulation,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { AssociationService, LeagueService } from '@floorball/core';
import {
  matchDayFromParams,
  writeMatchDayToUrl,
} from 'src/app/_helpers/_utils/match-day-param';
import { isKnockout } from 'src/app/_helpers/_utils/league-type';
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
  Subscription,
  take,
  takeUntil,
  tap,
} from 'rxjs';

@Component({
  templateUrl: './overview.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class OverviewComponent implements OnInit, OnDestroy {
  selectedAssociation$!: Observable<GameOperation | null>;
  selectedLeague$!: Observable<League | null>;
  singleLeague$!: Observable<League | null>;
  teamRankings$?: Observable<TableEntry[] | null>;
  playerRankings$?: Observable<ScorerEntry[] | null>;
  matches$?: Observable<GameScheduleEntry[] | null>;

  selectedMatchDay: { game_day_number: number; title: string } | null = null;
  selectedMatchDayMinDate?: Date;
  selectedMatchDayMaxDate?: Date;
  maxGamedayNumber = 0;
  intervalSub?: Subscription;

  private _destroy$ = new Subject<boolean>();

  // Der per zurück/weiter gewählte Spieltag. Solange nichts gewählt ist, sucht
  // die API den Spieltag aus (game_days/current). Ohne diese Merkung holte das
  // 30-Sekunden-Polling immer wieder den aktuellen Spieltag und warf die
  // Auswahl damit spätestens nach 30 Sekunden weg.
  //
  // Die Auswahl steht zusätzlich als `?spieltag=` in der Adresse, siehe
  // MATCH_DAY_PARAM.
  private _pinnedMatchDayNumber?: number;

  // Die Liga, für die zuletzt geladen wurde. selectedLeague$ meldet dieselbe
  // Liga mehrfach (leagues$ hängt an Verband und Saison, und der
  // Saison-Switcher zieht bei einem Deep-Link in eine alte Saison nach), ein
  // Ligawechsel ist das nur, wenn sich die Kennung ändert.
  private _loadedLeagueId?: number;

  // Turnierbaum statt Tabelle: Pokal und Playoffs/Playdowns. Als Feld, damit
  // das Template dieselbe Ableitung benutzt wie ngOnInit.
  public isKnockout = isKnockout;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _location: Location,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    @Inject(PLATFORM_ID) private _platformId: object
  ) {}

  ngOnInit(): void {
    // Die Adresse wird genau einmal gelesen, hier beim Aufbau. Zwei Gründe:
    //
    // 1. Ein späteres Lesen erwischt einen veralteten Snapshot. Beim Ligawechsel
    //    über die Seitenleiste bleibt diese Komponente am Leben (gleiche
    //    Routen-Konfiguration), und Angular schreibt die Elternroute VOR der
    //    Kindroute fort. In dem Moment, in dem `selectedLeague$` die neue Liga
    //    meldet, trägt der Snapshot dieser Ansicht noch die alten
    //    Abfrageparameter -- die Nummer der vorigen Liga wäre in die neue
    //    gewandert, ohne dass sie in der Adresse steht.
    // 2. Der Schreibweg (`Location.replaceState`, Begründung an
    //    writeMatchDayToUrl) führt den Snapshot ohnehin nicht nach.
    //
    // In-App-Links tragen den Parameter nie in eine andere Liga. Für die beiden
    // Wege, die zählen -- Direkteinstieg und Zurück aus einem Spiel -- ist die
    // Komponente frisch, und genau dann gilt der Wert.
    const matchDayFromUrl = this._matchDayFromUrl();

    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this.selectedLeague$ = this._leagueService.selectedLeague$;
    this._associationService.selectAssociation(this._route);
    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            if (this.intervalSub) {
              this.intervalSub.unsubscribe();
            }

            this.getSingleLeague(league.id);

            // Neue Liga, neue Ansicht: Die Auswahl der vorigen Liga gilt hier
            // nicht, deren Spieltagsnummer meint einen anderen Spieltag. Nur die
            // Liga, mit der diese Ansicht aufgebaut wurde, erbt die Nummer aus
            // der Adresse; jeder Wechsel danach beginnt ohne Auswahl.
            if (league.id !== this._loadedLeagueId) {
              const firstLeague = this._loadedLeagueId === undefined;
              this._loadedLeagueId = league.id;
              this._pinnedMatchDayNumber = firstLeague
                ? matchDayFromUrl
                : undefined;
            }

            if (!isKnockout(league)) {
              this.getTeamRanking(league.id);
              this.getMatches(league);
              this.selectedMatchDay = league.game_day_titles[0];
            }

            this.getPlayerRanking(league.id);

            this.maxGamedayNumber = league.game_day_titles.reduce(
              (max, item) => Math.max(max, item.game_day_number),
              0
            );

            this._metaTitle.setTitle(
              `${league.name} - Übersicht | Floorball Saisonmanager`
            );

            // league type cup has its own refetch method in matches-with-rounds component
            if (league.league_type === 'league') {
              this.intervalSub = interval(30000)
                .pipe(
                  tap(() => this.getMatches(league)),
                  takeUntil(this._destroy$)
                )
                .subscribe();
            }

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

  getDateRange(games: GameScheduleEntry[]) {
    this.selectedMatchDayMinDate = games.reduce(
      (min, item) => (min > new Date(item.date) ? new Date(item.date) : min),
      new Date(2999, 1, 1)
    );

    this.selectedMatchDayMaxDate = games.reduce(
      (min, item) => (min < new Date(item.date) ? new Date(item.date) : min),
      new Date(1990, 1, 1)
    );
  }

  getMatches(league: League) {
    // Ohne eigene Auswahl bestimmt die API den Spieltag, mit Auswahl wird genau
    // dieser nachgeladen. Beide Fälle laufen durch dieselbe Auswertung, damit
    // das Polling die Ansicht aktuell hält, ohne sie zu verschieben.
    const requestedMatchDay = this._pinnedMatchDayNumber;

    const games$ =
      requestedMatchDay === undefined
        ? this._leagueService.getGameScheduleForCurrentGameDay(league.id)
        : this._leagueService.getGameScheduleForGameDay(
            league.id,
            requestedMatchDay
          );

    this.matches$ = games$.pipe(shareReplay());

    this.matches$
      .pipe(
        take(1),
        tap((games) => {
          // Eine überholte Antwort darf die Anzeige nicht mehr verändern: Wer
          // während eines laufenden Nachladens weiterklickt, bekäme sonst den
          // Datumsbereich des vorigen Spieltags unter die neue Liste.
          if (requestedMatchDay !== this._pinnedMatchDayNumber) {
            return;
          }

          // Ein Spieltag ohne Spiele ist eine Sackgasse: Die Weiter-Zurück-
          // Leiste rechnet mit der Spieltagsnummer der ersten Zeile, die es
          // hier nicht gibt. Die Auswahl deshalb wieder aufgeben, damit das
          // nächste Nachladen zum aktuellen Spieltag zurückfindet.
          if (!games || !games.length) {
            this._pinnedMatchDayNumber = undefined;

            // Nur wenn wirklich ein Spieltag angefordert war. Ohne diese Wache
            // schriebe eine Liga ganz ohne angesetzte Spiele bei jedem
            // Polling-Takt die Adresse und lüde sich im Kreis; so terminiert es
            // nach einem Durchgang. Geprüft wird der eigene Zustand und nicht
            // die Adresse: die ist über `Location.replaceState` geschrieben, der
            // Router führt den Snapshot also nicht nach.
            if (requestedMatchDay !== undefined) {
              this._writeMatchDayToUrl(undefined);
              // Und gleich den von der API bestimmten Spieltag holen, sonst
              // stünde die Ansicht bis zum nächsten Takt leer da -- bis zu 30
              // Sekunden nach einem Lesezeichen auf einen leer gewordenen
              // Spieltag.
              this.getMatches(league);
            }

            this._cdr.markForCheck();
            return;
          }

          this.selectedMatchDay =
            league.game_day_titles.find(
              (_item) => _item.game_day_number === games[0].game_day
            ) ??
            league.game_day_titles[0] ??
            null;

          this.getDateRange(games);

          this._cdr.markForCheck();
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  getSingleLeague(leagueNumber: number) {
    this.singleLeague$ = this._leagueService.getSingleLeague(leagueNumber);
  }

  selectMatchDay(matchDay: number, league: League) {
    this._pinnedMatchDayNumber = matchDay;

    // Schon vor der Antwort setzen, damit der Titel zur Auswahl passt und nicht
    // zum zuletzt geladenen Spieltag.
    this.selectedMatchDay =
      league.game_day_titles.find(
        (_item) => _item.game_day_number === matchDay
      ) ?? null;

    this._writeMatchDayToUrl(matchDay);
    this.getMatches(league);
  }

  private _matchDayFromUrl(): number | undefined {
    return matchDayFromParams(this._route.snapshot.queryParamMap);
  }

  private _writeMatchDayToUrl(matchDay?: number): void {
    writeMatchDayToUrl(
      this._router,
      this._location,
      this._route,
      this._platformId,
      matchDay
    );
  }
}
