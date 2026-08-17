import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { LeagueService } from '@floorball/core';
import { GameScheduleEntry, League } from '@floorball/types';
import { Observable, shareReplay, Subject, take, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'fb-tournament-matches',
  templateUrl: './tournament-matches.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TournamentMatchesComponent implements OnInit, OnDestroy {
  private _destroy$ = new Subject<boolean>();

  // Sobald jemand die Reiter selbst umgeschaltet hat, hält die Vorauswahl
  // still. Nötig, weil selectedLeague$ dieselbe Liga mehrfach meldet und jede
  // Meldung den Spielplan neu lädt – ohne diese Sperre spränge die Ansicht
  // dabei wieder zurück.
  private _roundPicked = false;
  private _loadedLeagueId?: number;

  round = 0;

  constructor(private _leagueService: LeagueService) {}

  @Input()
  selectedLeague?: League;

  matches$?: Observable<GameScheduleEntry[]>;

  // Reiterwechsel von Hand.
  selectRound(round: number) {
    this._roundPicked = true;
    this.round = round;
  }

  getMatches(leagueNumber: number) {
    // Andere Liga, andere Vorauswahl: Die Sperre gilt nur für die Liga, in der
    // umgeschaltet wurde.
    if (this._loadedLeagueId !== leagueNumber) {
      this._loadedLeagueId = leagueNumber;
      this._roundPicked = false;
      this.round = 0;
    }

    this.matches$ = this._leagueService.getGameSchedule(leagueNumber).pipe(
      tap((matches) => this._preselectRound(leagueNumber, matches)),
      shareReplay()
    );

    this.matches$.pipe(take(1), takeUntil(this._destroy$)).subscribe();
  }

  // Läuft die Platzierungsrunde bereits, ist sie und nicht mehr die
  // Gruppenphase der Grund, weshalb jemand den Spieltag öffnet. Maßgeblich ist
  // der Anpfiff: Ein bereits beendetes Platzierungsspiel zählt mit, ein bloß
  // angesetztes nicht. Platzierungsspiele sind die Spiele ohne Gruppe
  // (group_identifier), dieselbe Abgrenzung wie in der finalRounds-Pipe.
  //
  // Die Antwort der zuvor angezeigten Liga wird verworfen: Ein Ligawechsel
  // bricht die laufende Anfrage nicht ab, und trifft die alte Antwort später
  // ein, stellte sie sonst den Reiter nach fremden Spielen ein.
  private _preselectRound(leagueNumber: number, matches: GameScheduleEntry[]) {
    if (this._roundPicked || this._loadedLeagueId !== leagueNumber) {
      return;
    }

    this.round = matches.some((m) => !m.group_identifier && m.started) ? 1 : 0;
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
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
}
