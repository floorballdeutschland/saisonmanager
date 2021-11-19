import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { GameEvent } from '@floorball/types';

@Component({
  selector: 'fb-match-history',
  templateUrl: './match-history.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchHistoryComponent {
  @Input()
  gameEvents!: GameEvent[];
}
