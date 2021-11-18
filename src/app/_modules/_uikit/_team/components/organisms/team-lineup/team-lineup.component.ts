import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { GamePlayerEntry } from '@floorball/models';

@Component({
  selector: 'fb-team-lineup',
  templateUrl: './team-lineup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class TeamLineupComponent {
  @Input()
  lineup!: GamePlayerEntry[];
}
