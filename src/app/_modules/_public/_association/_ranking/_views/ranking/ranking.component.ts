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
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    @Inject(PLATFORM_ID) private _platformId: object
  ) {}

  ngOnInit(): void {
    this.selectedLeague$ = this._leagueService.selectedLeague$;

    this.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this._metaTitle.setTitle(
              `${league.name} - Tabelle | Floorball Saisonmanager`
            );
            // Bei einem Einstieg auf `?spieltag=5` (Zurück-Weg aus einem Spiel)
            // gilt diese Nummer, sonst bestimmt die API den Spieltag.
            const requestedMatchDay = matchDayFromParams(
              this._route.snapshot.queryParamMap
            );
            // Vorbelegung vor dem Laden, damit der aus den Spielen ermittelte
            // Spieltag sie überschreibt und nicht umgekehrt.
            this.selectedMatchDay =
              league.game_day_titles?.find(
                (item) => item.game_day_number === requestedMatchDay
              ) ??
              league.game_day_titles?.[0] ??
              null;
            this.getTeamRanking(league.id);
            this.getMatches(league, requestedMatchDay);
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

    // Wie in der Uebersicht: Der gewaehlte Spieltag gehoert in die Adresse,
    // sonst ist er nach dem Sprung in ein Spiel verloren.
    writeMatchDayToUrl(
      this._router,
      this._route,
      this._platformId,
      matchDay
    );

    this.matches$ = this._leagueService
      .getGameScheduleForGameDay(league.id, matchDay)
      .pipe(shareReplay());
  }
}
