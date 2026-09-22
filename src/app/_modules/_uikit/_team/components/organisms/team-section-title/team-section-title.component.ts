import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

// Zwischenüberschrift innerhalb der Aufstellung (Betreuer, Starting six,
// Auszeichnungen). Bewusst kleiner, grau und gesperrt gesetzt, damit sie sich
// vom Mannschaftsnamen darüber unterscheidet: vorher trugen beide Ebenen
// dieselbe Schrift und sahen gleichrangig aus. Die andere Hälfte des
// Unterschieds steht am Mannschaftsnamen selbst, der im Gegenzug größer
// gesetzt und mit einer Linie abgesetzt ist.
//
// Das Mannschaftskürzel steht nur in der einspaltigen Handy-Ansicht daneben.
// Auf dem Desktop sagt die Spalte schon, um welche Mannschaft es geht; beim
// Scrollen auf dem Handy ist der Mannschaftsname dagegen längst aus dem Bild.
@Component({
  selector: 'fb-team-section-title',
  templateUrl: './team-section-title.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TeamSectionTitleComponent {
  @Input()
  title!: string;

  @Input()
  teamShortName?: string;
}
