import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { Game } from '@floorball/types';

@Component({
  selector: 'fb-match-header',
  templateUrl: './match-header.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchHeaderComponent {
  @Input()
  game!: Game;
}
