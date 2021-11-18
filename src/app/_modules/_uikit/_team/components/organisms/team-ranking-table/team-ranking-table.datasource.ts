import { BehaviorSubject } from 'rxjs';
import { DataSource } from '@angular/cdk/collections';
import { TableEntry } from '../../../../../../_models';

export class TeamRankingTableDatasoure extends DataSource<TableEntry> {
  data = new BehaviorSubject<TableEntry[]>([]);

  connect() {
    return this.data;
  }

  disconnect() {
    // Stub
  }
}
