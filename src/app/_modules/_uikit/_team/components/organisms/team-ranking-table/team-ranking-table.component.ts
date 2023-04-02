import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { TableEntry } from '@floorball/models';
import { TeamRankingTableDatasoure } from './team-ranking-table.datasource';

@Component({
  selector: 'fb-team-ranking-table',
  templateUrl: './team-ranking-table.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamRankingTableComponent implements OnChanges {
  @Input()
  data!: TableEntry[];

  @Input()
  type: 'small' | 'medium' | 'default' = 'default';

  @Input()
  routerPrefix: string[] = ['./', 'team'];

  dataSource = new TeamRankingTableDatasoure();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']?.currentValue) {
      this.dataSource.data.next(changes['data'].currentValue);
    }
  }
}
