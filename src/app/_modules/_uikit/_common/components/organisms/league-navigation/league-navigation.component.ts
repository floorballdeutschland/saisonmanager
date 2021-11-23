import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { GameOperation, League } from '@floorball/types';

@Component({
  selector: 'fb-league-navigation',
  templateUrl: './league-navigation.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeagueNavigationComponent {
  @Input()
  leagues!: League[];

  @Input()
  selectedAssociation!: GameOperation;
}
