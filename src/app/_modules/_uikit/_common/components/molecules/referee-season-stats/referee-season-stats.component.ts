import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RefereeSeasonGameStat } from '@floorball/types';

/**
 * Einsatzzahlen eines Schiedsrichters für die laufende Saison und die
 * Vorsaison, je gesamt und nur Großfeld ab U15. Dieselbe Tabelle in der
 * Verbands-, der Vereins- und der eigenen Sicht, weil die Zahlen bei der
 * Lizenzerteilung nachvollziehbar sein sollen. Gezählt wird in der API
 * (RefereeSeasonGameStats), hier wird nur angezeigt.
 */
@Component({
  selector: 'fb-referee-season-stats',
  templateUrl: './referee-season-stats.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeSeasonStatsComponent {
  @Input({ required: true })
  stats: RefereeSeasonGameStat[] = [];
}
