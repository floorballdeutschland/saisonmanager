import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation
 } from '@angular/core';
import { Game } from '@floorball/models';

@Component({
  selector: 'fb-match-info',
  templateUrl: './match-info.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class MatchInfoComponent {
  @Input()
  game!: Game;
}
