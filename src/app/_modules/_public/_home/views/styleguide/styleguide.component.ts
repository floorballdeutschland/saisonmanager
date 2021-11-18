import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { ScorerEntry } from '../../../../../_models';

@Component({
  selector: 'app-styleguide',
  templateUrl: './styleguide.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StyleguideComponent {
  playerRankingMock: ScorerEntry[] = [
    {
      last_name: 'Last',
      first_name: 'test',
      penalty_2: 2,
      assists: 1,
      penalty_10: 10,
      position: 1,
      player_id: 1,
      games: 3,
      goals: 3,
      penalty_2and2: 2,
      sort: 1,
      penalty_5: 5,
      penalty_ms: 2,
    },
    {
      last_name: 'Last',
      first_name: 'test',
      penalty_2: 2,
      assists: 1,
      penalty_10: 10,
      position: 1,
      player_id: 1,
      games: 3,
      goals: 3,
      penalty_2and2: 2,
      sort: 1,
      penalty_5: 5,
      penalty_ms: 2,
    },
    {
      last_name: 'Last',
      first_name: 'test',
      penalty_2: 2,
      assists: 1,
      penalty_10: 10,
      position: 1,
      player_id: 1,
      games: 3,
      goals: 3,
      penalty_2and2: 2,
      sort: 1,
      penalty_5: 5,
      penalty_ms: 2,
    },
  ];
}
