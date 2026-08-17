import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { GameCoach } from '@floorball/models';

// Betreuerliste einer Mannschaft, wie sie unter der Aufstellung steht.
// Bleibt still, solange nichts erfasst ist: Ein leerer Abschnitt „Betreuer"
// sähe aus wie die Aussage, dass niemand auf der Bank saß.
@Component({
  selector: 'fb-team-coaches',
  templateUrl: './team-coaches.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class TeamCoachesComponent {
  @Input()
  coaches?: GameCoach[];
}
