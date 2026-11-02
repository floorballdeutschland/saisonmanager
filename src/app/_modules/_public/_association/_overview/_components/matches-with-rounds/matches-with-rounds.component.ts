import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { LeagueService } from '@floorball/core';
import { GameScheduleEntry, League } from '@floorball/types';
import {
  catchError,
  EMPTY,
  interval,
  Observable,
  of,
  shareReplay,
  Subject,
  Subscription,
  take,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';

@Component({
  selector: 'fb-matches-with-rounds',
  templateUrl: './matches-with-rounds.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MatchesWithRoundsComponent implements OnInit, OnDestroy {
  selectedLeague$!: Observable<League | null>;
  selectedMatchDay = 1;
  matches$?: Observable<GameScheduleEntry[] | null>;
  intervalSub?: Subscription;

  private _destroy$ = new Subject<boolean>();

  // Die zuletzt erfolgreich geladene Liste, Rückfall für einen gescheiterten
  // stillen Takt (siehe getMatches). Mit dem Schlüssel der Anfrage, damit nach
  // einem Wechsel der Liga oder des Spieltags nie die Liste der vorigen
  // Auswahl unter der neuen Überschrift erscheint.
  private _lastMatches?: { key: string; games: GameScheduleEntry[] | null };

  constructor(private _leagueService: LeagueService) {}

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
    this.selectedLeague$ = this._leagueService.selectedLeague$;

    this.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            if (this.intervalSub) {
              this.intervalSub.unsubscribe();
            }

            this.getMatches(league.id);

            this.intervalSub = interval(30000)
              .pipe(
                tap(() => this.getMatches(league.id, true)),
                takeUntil(this._destroy$)
              )
              .subscribe();
          }
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  /**
   * `silent` trennt den ersten Abruf vom Nachladen im Takt: Nur der erste soll
   * einen Fehlschlag melden, siehe SILENT_REFRESH.
   */
  getMatches(leagueNumber: number, silent = false) {
    // Scheitert ein stiller Takt, bleibt die zuletzt geladene Liste stehen.
    // Ohne diesen Rückfall wäre das Schweigen eine Zumutung: `matches$` wird
    // bei jedem Takt neu gesetzt, die `async`-Pipe verwirft dabei ihren Wert,
    // und die Begegnungen verschwänden wortlos bis zum nächsten Takt.
    //
    // Zurückgegriffen wird auf den zuletzt geladenen WERT, nicht auf das
    // vorige Observable. `shareReplay` hält keine Fehler fest: Solange noch
    // kein Abruf geglückt war (Tab ohne Netz geöffnet, erster Abruf mit 429),
    // schickte ein Abonnieren des Vorgängers dessen Abruf erneut los, und
    // dessen Rückfall wieder den seines Vorgängers. Takt n feuerte so n Abrufe
    // auf einmal, riss die Grenze von 300 Abrufen pro Minute je Sitzung, und
    // die 429-Antworten hielten die Kette am Leben (SAISONMANAGER-2D).
    const key = String(leagueNumber);
    const fallback =
      this._lastMatches?.key === key ? this._lastMatches.games : undefined;

    this.matches$ = this._leagueService
      .getGameScheduleForCurrentGameDay(leagueNumber, silent)
      .pipe(
        tap((games) => (this._lastMatches = { key, games })),
        catchError((err) => {
          if (!silent) return throwError(() => err);
          // Ohne geladene Liste gibt es nichts stehen zu lassen; ein Wurf hier
          // landete je Takt als unbehandelter Fehler in Sentry.
          return fallback !== undefined ? of(fallback) : EMPTY;
        }),
        shareReplay()
      );

    this.matches$
      .pipe(
        take(1),
        tap((games) => {
          if (!games || !games[0]) {
            return;
          }
          this.selectedMatchDay = games[0].game_day;
        }),
        // Einen stillen Fehler schlucken: Er hat hier oben schon seinen Rückfall,
        // und unbehandelt landete jeder gescheiterte Takt in Sentry. Ein lauter
        // Fehler (Erstaufruf, Spieltagswechsel) läuft weiter durch und wird
        // gemeldet, auch dort, wo das Template `matches$` nicht abonniert.
        catchError((err) => (silent ? EMPTY : throwError(() => err))),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  selectMatchDay(matchDay: number, leagueNumber: number) {
    this.selectedMatchDay = matchDay;

    this.matches$ = this._leagueService.getGameScheduleForGameDay(
      leagueNumber,
      matchDay
    );
  }
}
