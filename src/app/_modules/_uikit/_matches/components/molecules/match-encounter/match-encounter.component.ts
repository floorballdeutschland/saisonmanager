import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { GameScheduleEntry } from '@floorball/types';

@Component({
  selector: 'fb-match-encounter',
  templateUrl: './match-encounter.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MatchEncounterComponent {
  @Input()
  match!: GameScheduleEntry;

  @Input()
  baseRoute: string[] = ['../'];

  @Input()
  withMatchDay = false;

  @Input()
  widthMatchTitle = false;

  @Input()
  currentIndex?: number;

  @Input()
  widthTreeView?: boolean;
}
