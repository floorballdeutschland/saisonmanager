import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { GamePlayerEntry } from '@floorball/models';
import { filter } from 'rxjs';

@Component({
  selector: 'fb-team-lineup',
  templateUrl: './team-lineup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class TeamLineupComponent {
  @Input()
  lineup!: GamePlayerEntry[];
  protected readonly filter = filter;
}
