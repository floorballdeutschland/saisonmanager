import { BehaviorSubject } from 'rxjs';
import { DataSource } from '@angular/cdk/collections';
import { ScorerEntry } from '../../../../../../_models';

export class PlayerRankingTableDatasoure extends DataSource<ScorerEntry> {
  data = new BehaviorSubject<ScorerEntry[]>([]);

  connect() {
    return this.data;
  }

  disconnect() {
    // Stub
  }
}
