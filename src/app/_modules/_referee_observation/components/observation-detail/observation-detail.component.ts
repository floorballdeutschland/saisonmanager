import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { RefereeObservation } from '@floorball/types';
import {
  OBSERVATION_DIMENSIONS,
  ObservationDimensionDefinition,
} from '../../observation-dimensions';

/**
 * Ein fertiger Beobachtungsbogen, lesend. Von drei Stellen genutzt: der Coach
 * sieht seine abgegebenen Bögen, die beobachtete Person ihre erhaltenen, die
 * Schiedsrichterverwaltung die am Profil. Deshalb liegt die Komponente in einem
 * eigenen geteilten Modul mit dem Transloco-Scope – sonst löst der Scope nur in
 * dem Modul auf, das ihn zufällig deklariert.
 *
 * Die Spalten des Rasters ergeben sich aus dem Bogen selbst: `ratings` enthält
 * in der Sicht der beobachteten Person nur die eigene Zeile, in Coach- und
 * Verwaltungssicht das ganze Gespann.
 */
@Component({
  selector: 'fb-referee-observation-detail',
  templateUrl: './observation-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ObservationDetailComponent {
  @Input({ required: true }) observation!: RefereeObservation;
  /** Blendet den Namen des Coaches aus, wo er ohnehin überall derselbe ist. */
  @Input() showCoach = true;

  dimensions: ObservationDimensionDefinition[] = OBSERVATION_DIMENSIONS;

  /** Bewertete Personen als Spalten, in Gespann-Reihenfolge. */
  get ratedReferees() {
    return [...(this.observation.ratings ?? [])].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );
  }

  ratingFor(refereeIndex: number, dimension: ObservationDimensionDefinition) {
    return this.ratedReferees[refereeIndex]?.[dimension.ratingKey] ?? null;
  }

  pairRating(dimension: ObservationDimensionDefinition) {
    return this.observation[dimension.pairKey] ?? null;
  }

  comment(dimension: ObservationDimensionDefinition) {
    return dimension.commentKey
      ? (this.observation[dimension.commentKey] ?? null)
      : null;
  }

  formatDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  matchLink(): (string | number)[] | null {
    const o = this.observation;
    if (!o.game_operation_slug || !o.league_id) return null;
    return ['/', o.game_operation_slug, o.league_id, 'spiel', o.game_id];
  }
}
