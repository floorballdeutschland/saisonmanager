import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { GameEvent } from '@floorball/types';

@Component({
  selector: 'fb-match-history-item',
  templateUrl: './match-history-item.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class MatchHistoryItemComponent {
  @Input()
  gameEvent!: GameEvent;
}
