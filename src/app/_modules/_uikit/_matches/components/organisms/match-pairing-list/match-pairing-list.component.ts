import {
  ChangeDetectionStrategy,
  Component,
  Input,
  TrackByFunction,
  ViewEncapsulation,
} from '@angular/core';
import { GameScheduleEntry } from '@floorball/types';

@Component({
  selector: 'fb-match-pairing-list',
  templateUrl: './match-pairing-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class MatchPairingListComponent {
  @Input()
  matches!: GameScheduleEntry[];

  trackByFn: TrackByFunction<GameScheduleEntry> = (_, option) => option.game_id;
}
