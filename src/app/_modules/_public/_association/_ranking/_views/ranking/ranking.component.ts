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
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Observable, shareReplay, Subject, take, takeUntil, tap } from 'rxjs';
import { GameScheduleEntry, League, TableEntry } from '@floorball/types';
import { LeagueService } from '@floorball/core';
import {
  matchDayFromParams,
  writeMatchDayToUrl,
} from 'src/app/_helpers/_utils/match-day-param';
import { Title } from '@angular/platform-browser';

@Component({
  templateUrl: './ranking.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RankingComponent implements OnInit, OnDestroy {
  teamRankings$?: Observable<TableEntry[] | null>;
  matches$?: Observable<GameScheduleEntry[] | null>;
  selectedLeague$!: Observable<League | null>;

  selectedMatchDay: { game_day_number: number; title: string } | null = null;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _location: Location,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    @Inject(PLATFORM_ID) private _platformId: object
  ) {}

  ngOnInit(): void {
    // Einmal beim Aufbau, aus denselben Gründen wie in der Übersicht: Ein
    // späteres Lesen erwischte beim Ligawechsel einen veralteten Snapshot, und
    // der Schreibweg über Location.replaceState führt ihn nicht nach.
    const matchDayFromUrl = matchDayFromParams(
      this._route.snapshot.queryParamMap
    );

    this.selectedLeague$ = this._leagueService.selectedLeague$;

    this.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this._metaTitle.setTitle(
              `${league.name} - Tabelle | Floorball Saisonmanager`
            );
            // Vorbelegung vor dem Laden, damit der aus den Spielen ermittelte
            // Spieltag sie überschreibt und nicht umgekehrt. Bei einem Einstieg
            // auf `?spieltag=5` (Zurück-Weg aus einem Spiel) gilt diese Nummer.
            this.selectedMatchDay =
              league.game_day_titles?.find(
                (item) => item.game_day_number === matchDayFromUrl
              ) ??
              league.game_day_titles?.[0] ??
              null;
            this.getTeamRanking(league.id);
            this.getMatches(league, matchDayFromUrl);
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

  getMatches(league: League, matchDay?: number) {
    this.matches$ = (
      matchDay === undefined
        ? this._leagueService.getGameScheduleForCurrentGameDay(league.id)
        : this._leagueService.getGameScheduleForGameDay(league.id, matchDay)
    ).pipe(shareReplay());

    this.matches$
      .pipe(
        take(1),
        tap((games) => {
          // Eine Liga ohne angesetzte Spiele liefert ein leeres Array. Die
          // Spieltagsnummer der ersten Zeile gibt es dann nicht, deshalb die
          // Vorauswahl aus dem ersten Spieltagstitel beibehalten.
          if (!games || !games.length) {
            // War ein Spieltag ausdrücklich angefordert (Lesezeichen auf einen
            // inzwischen leeren, oder eine verbogene Adresse), dann behauptete
            // die Adresse eine Nummer, das Auswahlfeld zeigte den ersten
            // Spieltag und die Liste war leer -- drei Aussagen, drei
            // verschiedene Spieltage. Anders als die Übersicht hat diese Seite
            // kein Polling, das sich selbst wieder einfängt, also hier räumen.
            if (matchDay !== undefined) {
              this._writeMatchDayToUrl(undefined);
              this.getMatches(league);
            }
            return;
          }
          this.selectedMatchDay =
            league.game_day_titles?.find(
              (_item) => _item.game_day_number === games[0].game_day
            ) ??
            league.game_day_titles?.[0] ??
            null;
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  selectMatchDay(matchDay: number, league: League) {
    this.selectedMatchDay =
      league.game_day_titles?.find(
        (_item) => _item.game_day_number === matchDay
      ) ?? null;

    // Wie in der Übersicht: Der gewählte Spieltag gehört in die Adresse, sonst
    // ist er nach dem Sprung in ein Spiel verloren.
    this._writeMatchDayToUrl(matchDay);

    // Über getMatches und nicht mit einer eigenen Kopie des Aufrufs: So gilt
    // auch hier die Behandlung des leeren Spieltags, und der Titel wird aus der
    // Antwort nachgezogen, statt der Titelliste blind zu glauben.
    this.getMatches(league, matchDay);
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
