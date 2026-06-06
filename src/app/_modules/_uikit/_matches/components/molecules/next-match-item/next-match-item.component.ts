import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { GameScheduleEntry } from '@floorball/types';

@Component({
  selector: 'fb-next-match-item',
  templateUrl: './next-match-item.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class NextMatchItemComponent {
  @Input()
  match!: GameScheduleEntry;

  @Input()
  routerPrefix: string[] = ['./', 'spiel'];
}
