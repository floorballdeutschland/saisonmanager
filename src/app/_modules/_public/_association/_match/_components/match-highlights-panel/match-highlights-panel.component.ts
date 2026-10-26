import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import {
  catchError,
  interval,
  map,
  of,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs';
import { GameStatsService } from '@floorball/core';
import { Game, Highlights, ShotTeam } from '@floorball/types';
import { hasPlayableHighlights } from '../../_utils/highlights';

interface LoadRequest {
  gameId: number;
  silent: boolean;
}

interface LoadResult {
  gameId: number;
  highlights: Highlights | null;
}

/** Laufende Spiele holen die Szenen in diesem Takt nach. */
export const HIGHLIGHTS_REFRESH_MS = 30000;

/**
 * Torszenen auf der Übersicht der Spielseite (fe#611), samt Link
 * „Highlights bearbeiten“ für Admin und SBK. Erscheint nur bei Spielen mit
 * `tablet_capture`, das entscheidet die Spielseite.
 *
 * Wie die ausführliche Statistik: Die Spielseite bleibt beim Wechsel in ein
 * anderes Spiel dieselbe Komponente und tauscht nur `game`. Ein neuer
 * `game.id` lädt deshalb sofort neu, setzt den alten Stand zurück und
 * verwirft Antworten, die noch für das vorige Spiel unterwegs sind.
 */
@Component({
  selector: 'fb-match-highlights-panel',
  templateUrl: './match-highlights-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MatchHighlightsPanelComponent implements OnChanges, OnDestroy {
  @Input() game!: Game;

  /** `undefined` solange nicht geladen. */
  highlights?: Highlights;
  /** YouTube hat das Video abgelehnt (privat, gelöscht): Szenen still weg. */
  unavailable = false;

  private _load$ = new Subject<LoadRequest>();
  private _destroy$ = new Subject<void>();

  constructor(
    private _statsService: GameStatsService,
    private _cdr: ChangeDetectorRef
  ) {
    this._load$
      .pipe(
        // switchMap bricht den Abruf für das vorige Spiel ab; die Prüfung in
        // applyResult fängt zusätzlich eine Antwort, die schon unterwegs war.
        switchMap(({ gameId, silent }) =>
          this._statsService.getHighlights(gameId, silent).pipe(
            catchError(() => of(null)),
            map((highlights): LoadResult => ({ gameId, highlights }))
          )
        ),
        takeUntil(this._destroy$)
      )
      .subscribe((result) => this.applyResult(result));

    // Neue Szenen ändern das Spiel nicht zwingend (eine Vormerkung am Tablet
    // ist kein Tor), müssen aber trotzdem binnen 30 s erscheinen. Deshalb
    // lädt ein laufendes Spiel im Takt nach und nicht bei Spieländerungen.
    interval(HIGHLIGHTS_REFRESH_MS)
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.onRefreshTick());
  }

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['game'];
    if (!change || !this.game?.id) return;

    const previousId = (change.previousValue as Game | undefined)?.id;
    if (previousId !== this.game.id) {
      this.highlights = undefined;
      this.unavailable = false;
      this._load$.next({ gameId: this.game.id, silent: false });
    } else if (this.game.ended) {
      // Nach Spielende läuft kein Takt mehr. Ändert sich das Spiel dann noch
      // (Abschluss, Nachträge), still nachladen.
      this._load$.next({ gameId: this.game.id, silent: true });
    }
  }

  /** Ein Schlag des Takts: nur laufende Spiele laden nach. */
  onRefreshTick(): void {
    if (this.game?.id && !this.game.ended) {
      this._load$.next({ gameId: this.game.id, silent: true });
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  private applyResult({ gameId, highlights }: LoadResult): void {
    if (gameId !== this.game?.id) return;
    // Ein Aussetzer beim Nachladen lässt den bisherigen Stand stehen.
    if (highlights) this.highlights = highlights;
    this._cdr.markForCheck();
  }

  get showHighlights(): boolean {
    return !this.unavailable && hasPlayableHighlights(this.highlights);
  }

  /**
   * Admin und SBK des Spielbetriebs dürfen Versatz und Auswahl der Highlights
   * jederzeit ändern (api#838). Dieselbe Grenze wie `check_game`.
   */
  get canEditHighlights(): boolean {
    return !!this.game?.permission?.includes('check_game');
  }

  onUnavailable(): void {
    this.unavailable = true;
    this._cdr.markForCheck();
  }

  /** Kurzname für die Szenenliste, voller Name als Rückfall. */
  teamShortName(team: ShotTeam): string {
    return team === 'home'
      ? this.game.home_team_short_name || this.game.home_team_name
      : this.game.guest_team_short_name || this.game.guest_team_name;
  }
}
