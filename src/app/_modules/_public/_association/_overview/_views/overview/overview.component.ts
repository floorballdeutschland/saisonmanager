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
  private _pinnedMatchDayNumber?: number;

  // Die Liga, für die zuletzt geladen wurde. selectedLeague$ meldet dieselbe
  // Liga mehrfach (leagues$ hängt an Verband und Saison, und der
  // Saison-Switcher zieht bei einem Deep-Link in eine alte Saison nach), ein
  // Ligawechsel ist das nur, wenn sich die Kennung ändert.
  private _loadedLeagueId?: number;

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
            if (this.intervalSub) {
              this.intervalSub.unsubscribe();
            }

            this.getSingleLeague(league.id);

            // Neue Liga, neue Ansicht: Die Auswahl der vorigen Liga gilt hier
            // nicht, deren Spieltagsnummer meint einen anderen Spieltag.
            if (league.id !== this._loadedLeagueId) {
              this._loadedLeagueId = league.id;
              this._pinnedMatchDayNumber = undefined;
            }

            if (league.league_type !== 'cup') {
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

    this.getMatches(league);
  }
}
