import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
} from '@angular/core';
import { DetailedStatsShot, ShotResult, ShotTeam } from '@floorball/types';
import { FieldPoint, RINK, toFieldPoint } from '../../_utils/detailed-stats';

interface PlottedShot extends FieldPoint {
  shot: DetailedStatsShot;
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

  readonly rink = RINK;
  readonly colors = SHOT_COLORS;
  plotted: PlottedShot[] = [];

  ngOnChanges(): void {
    // Tore zuletzt, damit sie über den übrigen Punkten liegen.
    this.plotted = [...this.shots]
      .sort((a, b) => Number(a.result === 'goal') - Number(b.result === 'goal'))
      .map((shot) => ({ shot, ...toFieldPoint(shot) }));
  }

  /** Zielt das Team nach rechts? Steuert den Pfeil unter dem Feld. */
  get attacksRight(): boolean {
    return this.team === 'home';
  }

  shooterLabel(shot: DetailedStatsShot): string {
    if (!shot.shooter) return '';
    const number =
      shot.shooter.trikot_number !== null
        ? `#${shot.shooter.trikot_number} `
        : '';
    return number + shot.shooter.name;
  }
}
