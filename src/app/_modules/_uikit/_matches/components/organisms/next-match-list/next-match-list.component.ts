import {
  ChangeDetectionStrategy,
  Component,
  Input,
  TrackByFunction,
  ViewEncapsulation,
} from '@angular/core';
import { GameScheduleEntry } from '@floorball/types';

@Component({
  selector: 'fb-next-match-list',
  templateUrl: './next-match-list.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NextMatchListComponent {
  @Input()
  matches!: GameScheduleEntry[];

  trackByFn: TrackByFunction<GameScheduleEntry> = (_, option) => option.game_id;
}
