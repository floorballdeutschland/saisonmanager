import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
} from '@angular/core';
import { DetailedStatsFreeHit, PeriodTitles, ShotTeam } from '@floorball/types';
import {
  FieldGeometry,
  FieldMarkings,
  fieldGeometry,
  fieldMarkings,
} from 'src/app/_helpers/_utils/field-geometry';
import {
  FieldPoint,
  FreeHitZone,
  freeHitZone,
  toFieldPoint,
} from '../../_utils/detailed-stats';

interface PlottedFreeHit extends FieldPoint {
  freeHit: DetailedStatsFreeHit;
  zone: FreeHitZone;
}

/** Farben je Zone, dieselben in Grafik und Legende. */
export const FREE_HIT_ZONE_COLORS: Record<FreeHitZone, string> = {
  own_half: '#9ca3af',
  opponent_half: '#f59e0b',
  near_goal_area: '#dc2626',
};

/**
 * Spielfeld mit den Freischlagpositionen eines Teams (fe#589). Ausrichtung
 * wie im Schussbild: Heim führt nach rechts aus, Gast nach links. Nur
 * Statistik: Freischläge haben keine Szenen und sind nicht anklickbar.
 */
@Component({
  selector: 'fb-free-hit-chart',
  templateUrl: './free-hit-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FreeHitChartComponent implements OnChanges {
  @Input() freeHits: DetailedStatsFreeHit[] = [];
  @Input() team: ShotTeam = 'home';
  @Input() teamName = '';
  @Input() periodTitles: PeriodTitles[] | null | undefined = [];
  /** `league.field_size` ('GF' / 'KF'); unbekannt zeichnet Großfeld. */
  @Input() fieldSize: string | null | undefined = null;

  readonly colors = FREE_HIT_ZONE_COLORS;
  field: FieldGeometry = fieldGeometry(null);
  markings: FieldMarkings = fieldMarkings(this.field);
  plotted: PlottedFreeHit[] = [];

  ngOnChanges(): void {
    this.field = fieldGeometry(this.fieldSize);
    this.markings = fieldMarkings(this.field);
    this.plotted = this.freeHits.map((freeHit) => ({
      freeHit,
      zone: freeHitZone(freeHit, this.field),
      ...toFieldPoint(freeHit, this.field),
    }));
  }

  get viewBox(): string {
    return `-0.5 -0.5 ${this.field.length + 1} ${this.field.width + 1}`;
  }

  /** Rauten bleiben auf dem Bildschirm gleich groß, wie im Schussbild. */
  get dotScale(): number {
    return this.field.length / 40;
  }

  get attacksRight(): boolean {
    return this.team === 'home';
  }

  periodTitle(period: number): string | null {
    return this.periodTitles?.find((p) => p.period === period)?.title ?? null;
  }

  /** Raute um den Punkt, in Metern. */
  diamond(point: FieldPoint): string {
    const r = 0.55 * this.dotScale;
    const { cx, cy } = point;
    return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
  }
}
