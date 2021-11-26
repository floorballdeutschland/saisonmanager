import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { NormalizedEvent } from '@floorball/types';

@Component({
  selector: 'fb-match-history-item',
  templateUrl: './match-history-item.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class MatchHistoryItemComponent {
  @Input()
  gameEvent!: NormalizedEvent;

  @Input()
  isLast = false;
}
