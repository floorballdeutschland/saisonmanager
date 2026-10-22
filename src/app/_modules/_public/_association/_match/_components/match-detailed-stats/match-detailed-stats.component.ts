import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  catchError,
  forkJoin,
  interval,
  map,
  of,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs';
import { GameStatsService } from '@floorball/core';
import {
  DetailedStats,
  DetailedStatsFreeHit,
  DetailedStatsShot,
  Game,
  GoalkeeperStats,
  Highlights,
  PlayerShotStats,
  ShotResult,
  ShotTeam,
  TeamShotStats,
} from '@floorball/types';
import { fieldGeometry } from 'src/app/_helpers/_utils/field-geometry';
import {
  FREE_HIT_ZONES,
  FreeHitZone,
  filterFreeHits,
  filterShots,
  freeHitZoneCounts,
  periodsOf,
  savePercentage,
  SHOT_RESULTS,
  sortPlayers,
  teamStatsFor,
} from '../../_utils/detailed-stats';
import {
  hasPlayableHighlights,
  sceneIndexForShot,
} from '../../_utils/highlights';
import { MatchHighlightsComponent } from '../match-highlights/match-highlights.component';
import { SHOT_COLORS } from '../shot-chart/shot-chart.component';
import { FREE_HIT_ZONE_COLORS } from '../free-hit-chart/free-hit-chart.component';

interface LoadRequest {
  gameId: number;
  silent: boolean;
}

interface LoadResult {
  gameId: number;
  stats: DetailedStats | null;
  highlights: Highlights | null;
}

export interface TeamStatsRow {
  /** `null` = ganzes Spiel. */
  period: number | null;
  stats: TeamShotStats;
}

/** Laufende Spiele holen die Statistik in diesem Takt nach. */
export const DETAILED_STATS_REFRESH_MS = 30000;

/**
 * Reiter „Ausführliche Statistik“ der öffentlichen Spielseite (fe#344).
 * Erscheint nur bei Spielen mit `tablet_capture`, das entscheidet die
 * Spielseite.
 *
 * Die Spielseite bleibt beim Wechsel in ein anderes Spiel dieselbe Komponente
 * und tauscht nur `game`. Deshalb lädt ein neuer `game.id` sofort neu, setzt
 * den alten Stand zurück und verwirft Antworten, die noch für das vorige Spiel
 * unterwegs sind.
 */
@Component({
  selector: 'fb-match-detailed-stats',
  templateUrl: './match-detailed-stats.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MatchDetailedStatsComponent implements OnChanges, OnDestroy {
  @Input() game!: Game;
  /** `league.field_size` für das Schussbild; unbekannt zeichnet Großfeld. */
  @Input() fieldSize: string | null | undefined = null;

  stats?: DetailedStats;
  loading = false;
  failed = false;
  /** `null` = alle Abschnitte. */
  selectedPeriod: number | null = null;
  periods: number[] = [];

  /** Torszenen (fe#555), `undefined` solange nicht geladen. */
  highlights?: Highlights;
  /** YouTube hat das Video abgelehnt (privat, gelöscht): Szenen still weg. */
  highlightsUnavailable = false;
  /** Tore der Schussgrafik, zu denen es eine Szene gibt. */
  linkedShots: ReadonlySet<DetailedStatsShot> = new Set();

  @ViewChild(MatchHighlightsComponent)
  highlightsPlayer?: MatchHighlightsComponent;

  readonly teams: ShotTeam[] = ['home', 'guest'];
  readonly results = SHOT_RESULTS;
  readonly colors = SHOT_COLORS;
  readonly freeHitZones = FREE_HIT_ZONES;
  readonly zoneColors = FREE_HIT_ZONE_COLORS;

  private _load$ = new Subject<LoadRequest>();
  private _destroy$ = new Subject<void>();

  constructor(
    private _statsService: GameStatsService,
    private _cdr: ChangeDetectorRef
  ) {
    this._load$
      .pipe(
        // switchMap bricht den Abruf für das vorige Spiel ab; die Prüfung im
        // subscribe fängt zusätzlich eine Antwort, die schon unterwegs war.
        // Statistik und Szenen scheitern unabhängig voneinander: Ohne Szenen
        // bleibt die Statistik vollständig.
        switchMap(({ gameId, silent }) =>
          forkJoin({
            stats: this._statsService
              .getDetailedStats(gameId, silent)
              .pipe(catchError(() => of(null))),
            highlights: this._statsService
              .getHighlights(gameId, silent)
              .pipe(catchError(() => of(null))),
          }).pipe(map((result): LoadResult => ({ gameId, ...result })))
        ),
        takeUntil(this._destroy$)
      )
      .subscribe((result) => this.applyResult(result));

    // Einzige Nachladequelle während des Spiels: Schüsse ändern das Spiel
    // selbst nicht (nur Tore tun das), müssen aber trotzdem binnen 30 s
    // erscheinen. Ein zusätzliches Nachladen bei jeder Spieländerung wäre
    // doppelt.
    interval(DETAILED_STATS_REFRESH_MS)
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.onRefreshTick());
  }

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['game'];
    if (!change || !this.game?.id) return;

    const previousId = (change.previousValue as Game | undefined)?.id;
    if (previousId !== this.game.id) {
      this.stats = undefined;
      this.periods = [];
      this.selectedPeriod = null;
      this.failed = false;
      this.highlights = undefined;
      this.highlightsUnavailable = false;
      this.linkedShots = new Set();
      this.loading = true;
      this._load$.next({ gameId: this.game.id, silent: false });
    } else if (this.game.ended) {
      // Nach Spielende läuft kein Takt mehr. Ändert sich das Spiel dann noch
      // (Abschluss, „Schüsse vollständig erfasst?“), still nachladen.
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

  private applyResult({ gameId, stats, highlights }: LoadResult): void {
    if (gameId !== this.game?.id) return;

    // Wie die Statistik: Ein Aussetzer beim Nachladen lässt die Szenen stehen.
    if (highlights) this.highlights = highlights;

    this.loading = false;
    if (stats) {
      this.stats = stats;
      this.failed = false;
      this.periods = periodsOf(stats);
      if (
        this.selectedPeriod !== null &&
        !this.periods.includes(this.selectedPeriod)
      ) {
        this.selectedPeriod = null;
      }
    } else if (!this.stats) {
      // Ein Aussetzer beim Nachladen lässt den bisherigen Stand stehen.
      this.failed = true;
    }
    this.updateLinkedShots();
    this._cdr.markForCheck();
  }

  get showHighlights(): boolean {
    return (
      !this.highlightsUnavailable && hasPlayableHighlights(this.highlights)
    );
  }

  onHighlightsUnavailable(): void {
    this.highlightsUnavailable = true;
    this.updateLinkedShots();
    this._cdr.markForCheck();
  }

  /** Klick auf ein Tor der Schussgrafik: zur Szene springen. */
  onGoalSelected(shot: DetailedStatsShot): void {
    if (!this.showHighlights || !this.highlights) return;
    const index = sceneIndexForShot(shot, this.highlights.scenes);
    if (index >= 0) this.highlightsPlayer?.jumpTo(index);
  }

  private updateLinkedShots(): void {
    const scenes = this.showHighlights ? (this.highlights?.scenes ?? []) : [];
    this.linkedShots = new Set(
      scenes.length
        ? (this.stats?.shots ?? []).filter(
            (shot) => sceneIndexForShot(shot, scenes) >= 0
          )
        : []
    );
  }

  selectPeriod(period: number | null): void {
    this.selectedPeriod = period;
    this._cdr.markForCheck();
  }

  get incomplete(): boolean {
    return !!this.stats && this.stats.complete !== true;
  }

  teamName(team: ShotTeam): string {
    return team === 'home'
      ? this.game.home_team_name
      : this.game.guest_team_name;
  }

  /** Kurzname für die Szenenliste, voller Name als Rückfall. */
  teamShortName(team: ShotTeam): string {
    return team === 'home'
      ? this.game.home_team_short_name || this.game.home_team_name
      : this.game.guest_team_short_name || this.game.guest_team_name;
  }

  /** Titel eines Abschnitts aus dem Spiel, sonst „n. Abschnitt“. */
  periodTitle(period: number): string | null {
    return (
      this.game.period_titles?.find((p) => p.period === period)?.title ?? null
    );
  }

  shotsFor(team: ShotTeam): DetailedStatsShot[] {
    return this.stats
      ? filterShots(this.stats.shots, team, this.selectedPeriod)
      : [];
  }

  countFor(team: ShotTeam, result: ShotResult): number {
    return this.shotsFor(team).filter((shot) => shot.result === result).length;
  }

  rowsFor(team: ShotTeam): TeamStatsRow[] {
    if (!this.stats) return [];
    const stats = this.stats;
    return [
      { period: null, stats: teamStatsFor(stats, team, null) },
      ...this.periods.map((period) => ({
        period,
        stats: teamStatsFor(stats, team, period),
      })),
    ];
  }

  // --- Freischläge (fe#589) ---------------------------------------------------

  /** Freischläge erfasst? Ältere Antworten ohne `free_hits` zählen als keine. */
  get hasFreeHits(): boolean {
    return !!this.stats?.free_hits?.length;
  }

  freeHitsFor(team: ShotTeam): DetailedStatsFreeHit[] {
    return this.stats
      ? filterFreeHits(this.stats.free_hits ?? [], team, this.selectedPeriod)
      : [];
  }

  zoneCountsFor(team: ShotTeam): Record<FreeHitZone, number> {
    return freeHitZoneCounts(
      this.freeHitsFor(team),
      fieldGeometry(this.fieldSize)
    );
  }

  goalkeepersFor(team: ShotTeam): GoalkeeperStats[] {
    return (this.stats?.goalkeepers ?? []).filter((gk) => gk.team === team);
  }

  playersFor(team: ShotTeam): PlayerShotStats[] {
    return sortPlayers(
      (this.stats?.players ?? []).filter((player) => player.team === team)
    );
  }

  get hasPlayers(): boolean {
    return !!this.stats?.players?.length;
  }

  get hasGoalkeepers(): boolean {
    return !!this.stats?.goalkeepers?.length;
  }

  savePercentage(goalkeeper: GoalkeeperStats): number | null {
    return savePercentage(goalkeeper);
  }
}
