import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { Game, GameEvent } from '@floorball/types';

@Component({
  selector: 'fb-match-history-item',
  templateUrl: './match-history-item.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class MatchHistoryItemComponent {
  /**
   * TODO
   * Fehlende EventTypes
   * penalty_shots
   * penalty_shot
   * http://localhost:4200/fvd/1044/spiel/17098
   */

  @Input()
  match!: Game;

  @Input()
  event!: GameEvent;

  @Input()
  isLast = false;
}
