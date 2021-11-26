import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { Game } from '@floorball/types';

@Component({
  selector: 'fb-match-history',
  templateUrl: './match-history.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchHistoryComponent {
  @Input()
  match!: Game;
}
