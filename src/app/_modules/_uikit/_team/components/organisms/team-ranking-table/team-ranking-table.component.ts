import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { TableEntry, TablePointCorrections } from '@floorball/models';
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

  point_corrections: TablePointCorrections[] = [];

  public setCorrections(table: TableEntry[]) {
    const corrections = table
      .map((entry) => entry.point_corrections)
      .filter((x): x is TablePointCorrections => x !== null);
    this.point_corrections = corrections;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']?.currentValue) {
      this.dataSource.data.next(changes['data'].currentValue);

      this.setCorrections(changes['data']?.currentValue);
    }
  }
}
