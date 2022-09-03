import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { GamePlayerEntry } from '@floorball/models';

@Component({
  selector: 'fb-team-squad',
  templateUrl: './team-squad.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class TeamSquadComponent {
  @Input() onClose!: () => void;
  @Input() players!: GamePlayerEntry[];
  @Input() team!: string;

  public filter = '';
  public filterTypes = [
    { type: '', title: 'Alle' },
    { type: 'selected', title: 'Ausgewählt' },
    { type: 'not-selected', title: 'Nicht ausgewählt' },
  ];

  setFilter(filterType: string) {
    this.filter = filterType;
  }
}
