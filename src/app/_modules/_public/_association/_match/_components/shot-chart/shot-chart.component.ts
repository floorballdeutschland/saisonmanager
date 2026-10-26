import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  DetailedStatsShot,
  PeriodTitles,
  ShotResult,
  ShotTeam,
} from '@floorball/types';
import {
  FieldGeometry,
  FieldMarkings,
  fieldGeometry,
  fieldMarkings,
} from 'src/app/_helpers/_utils/field-geometry';
import {
  FieldPoint,
  isPlacedShot,
  toFieldPoint,
} from '../../_utils/detailed-stats';
import { personLabel } from '../../_utils/highlights';

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
 * Gast nach links (siehe `toFieldPoint`). Gezeichnet in Metern, je nach
 * Feldgröße der Liga als Groß- oder Kleinfeld (fe#591).
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
  /** `league.field_size` ('GF' / 'KF'); unbekannt zeichnet Großfeld. */
  @Input() fieldSize: string | null | undefined = null;

  readonly colors = SHOT_COLORS;

  constructor(private _transloco: TranslocoService) {}

  field: FieldGeometry = fieldGeometry(null);
  markings: FieldMarkings = fieldMarkings(this.field);
  plotted: PlottedShot[] = [];

  ngOnChanges(): void {
    this.field = fieldGeometry(this.fieldSize);
    this.markings = fieldMarkings(this.field);
    // Tore zuletzt, damit sie über den übrigen Punkten liegen. Paraden ohne
    // Feldposition (Schnellzähler) haben hier keinen Platz.
    this.plotted = this.shots
      .filter(isPlacedShot)
      .sort((a, b) => Number(a.result === 'goal') - Number(b.result === 'goal'))
      .map((shot) => ({
        shot,
        ...toFieldPoint(shot, this.field),
      }));
  }

  /** Rand von einem halben Meter, damit Punkte an der Bande ganz sichtbar sind. */
  get viewBox(): string {
    return `-0.5 -0.5 ${this.field.length + 1} ${this.field.width + 1}`;
  }

  /**
   * Punkte bleiben auf dem Bildschirm gleich groß: Das Kleinfeld füllt mit
   * 28 m dieselbe Breite wie das Großfeld mit 40 m.
   */
  get dotScale(): number {
    return this.field.length / 40;
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

  /**
   * Kennungen eines Schusses für den Titel, z. B. „(Strafschuss)“. Im
   * SVG-`<title>` gibt es nur Text, keine Blöcke, deshalb hier übersetzt.
   */
  situationLabel(shot: DetailedStatsShot): string {
    const keys: string[] = [];
    if (shot.from_penalty_shot) keys.push('penaltyShot');
    if (shot.from_free_hit) keys.push('fromFreeHit');
    if (shot.empty_net) keys.push('emptyNet');
    if (shot.extra_attacker) keys.push('extraAttacker');
    return keys
      .map(
        (key) =>
          '(' +
          this._transloco.translate('match.detailedStats.situation.' + key) +
          ')'
      )
      .join(' ');
  }
}
