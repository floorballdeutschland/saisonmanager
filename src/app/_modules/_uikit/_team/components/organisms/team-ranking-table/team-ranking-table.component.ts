import {
  ChangeDetectionStrategy,
  Component,
  Input,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { TableEntry } from '../../../../../../_models';
import { TeamRankingTableDatasoure } from './team-ranking-table.datasource';

@Component({
  selector: 'fb-team-ranking-table',
  templateUrl: './team-ranking-table.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamRankingTableComponent {
  @Input()
  data!: TableEntry[];

  dataSource = new TeamRankingTableDatasoure();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']?.currentValue) {
      this.dataSource.data.next(changes['data'].currentValue);
    }
  }
}
