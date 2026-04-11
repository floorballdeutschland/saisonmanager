import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { GameOperation, League, Season } from '@floorball/types';

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
  selectedAssociation!: GameOperation | null;

  @Input()
  seasons: Season[] = [];

  @Input()
  selectedSeasonId: number | null = null;

  @Output()
  seasonChange = new EventEmitter<number>();

  onSeasonChange(event: Event) {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    this.seasonChange.emit(id);
  }
}
