import {
  ChangeDetectionStrategy,
  Component,
  Input,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { PlayerRankingTableDatasoure } from './player-ranking-table.datasource';
import { ScorerEntry } from '@floorball/models';

@Component({
  selector: 'fb-player-ranking-table',
  templateUrl: './player-ranking-table.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerRankingTableComponent {
  @Input()
  data!: ScorerEntry[];

  dataSource = new PlayerRankingTableDatasoure();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']?.currentValue) {
      this.dataSource.data.next(changes['data'].currentValue);
    }
  }
}
