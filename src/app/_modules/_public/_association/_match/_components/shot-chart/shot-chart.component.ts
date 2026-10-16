import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import {
  DetailedStatsShot,
  PeriodTitles,
  ShotResult,
  ShotTeam,
} from '@floorball/types';
import { FieldPoint, RINK, toFieldPoint } from '../../_utils/detailed-stats';
import { personLabel } from '../../_utils/highlights';

interface PlottedShot extends FieldPoint {
  shot: DetailedStatsShot;
  /** Tor mit Szene: Klick springt dorthin (fe#555). */
  linked: boolean;
}

/** Farben je Ergebnis, dieselben in Grafik und Legende. */
export const SHOT_COLORS: Record<ShotResult, string> = {
  goal: '#16a34a',
  saved: '#2563eb',
  blocked: '#f59e0b',
  missed: '#9ca3af',
};

/**
 * Spielfeld mit den Schusspositionen eines Teams. Heim greift nach rechts an,
 * Gast nach links (siehe `toFieldPoint`).
 */
@Component({
  selector: 'fb-shot-chart',
  templateUrl: './shot-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ShotChartComponent implements OnChanges {
  @Input() shots: DetailedStatsShot[] = [];
  @Input() team: ShotTeam = 'home';
  @Input() teamName = '';
  /** Abschnittstitel des Spiels, wie in Filter und Tabelle. */
  @Input() periodTitles: PeriodTitles[] | null | undefined = [];
  /** Tore, zu denen es eine Szene gibt. Ohne Szenen ist nichts anklickbar. */
  @Input() linkedShots: ReadonlySet<DetailedStatsShot> = new Set();

  @Output() goalSelected = new EventEmitter<DetailedStatsShot>();

  readonly rink = RINK;
  readonly colors = SHOT_COLORS;
  plotted: PlottedShot[] = [];

  ngOnChanges(): void {
    // Tore zuletzt, damit sie über den übrigen Punkten liegen.
    this.plotted = [...this.shots]
      .sort((a, b) => Number(a.result === 'goal') - Number(b.result === 'goal'))
      .map((shot) => ({
        shot,
        linked: this.linkedShots.has(shot),
        ...toFieldPoint(shot),
      }));
  }

  /** Zielt das Team nach rechts? Steuert den Pfeil unter dem Feld. */
  get attacksRight(): boolean {
    return this.team === 'home';
  }

  /** Titel eines Abschnitts aus dem Spiel, sonst `null` („n. Abschnitt“). */
  periodTitle(period: number): string | null {
    return this.periodTitles?.find((p) => p.period === period)?.title ?? null;
  }

  shooterLabel(shot: DetailedStatsShot): string {
    return personLabel(shot.shooter);
  }

  select(point: PlottedShot): void {
    if (point.linked) this.goalSelected.emit(point.shot);
  }
}
