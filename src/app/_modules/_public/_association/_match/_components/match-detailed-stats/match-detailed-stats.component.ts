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
import {
  DetailedStats,
  DetailedStatsShot,
  Game,
  GoalkeeperStats,
  PlayerShotStats,
  ShotResult,
  ShotTeam,
  TeamShotStats,
} from '@floorball/types';
import {
  filterShots,
  periodsOf,
  savePercentage,
  SHOT_RESULTS,
  sortPlayers,
  teamStatsFor,
} from '../../_utils/detailed-stats';
import { SHOT_COLORS } from '../shot-chart/shot-chart.component';

interface LoadRequest {
  gameId: number;
  silent: boolean;
}

interface LoadResult {
  gameId: number;
  stats: DetailedStats | null;
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

  stats?: DetailedStats;
  loading = false;
  failed = false;
  /** `null` = alle Abschnitte. */
  selectedPeriod: number | null = null;
  periods: number[] = [];

  readonly teams: ShotTeam[] = ['home', 'guest'];
  readonly results = SHOT_RESULTS;
  readonly colors = SHOT_COLORS;

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
        switchMap(({ gameId, silent }) =>
          this._statsService.getDetailedStats(gameId, silent).pipe(
            map((stats): LoadResult => ({ gameId, stats })),
            catchError(() => of<LoadResult>({ gameId, stats: null }))
          )
        ),
        takeUntil(this._destroy$)
      )
      .subscribe((result) => this.applyResult(result));

    interval(DETAILED_STATS_REFRESH_MS)
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        if (this.game?.id && !this.game.ended) {
          this._load$.next({ gameId: this.game.id, silent: true });
        }
      });
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
      this.loading = true;
      this._load$.next({ gameId: this.game.id, silent: false });
    } else {
      // Dasselbe Spiel mit neuem Stand (Tor, Abschluss, Vollständigkeit):
      // still nachladen, die Ansicht behält bis dahin ihren Stand.
      this._load$.next({ gameId: this.game.id, silent: true });
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  private applyResult({ gameId, stats }: LoadResult): void {
    if (gameId !== this.game?.id) return;

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
    this._cdr.markForCheck();
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
