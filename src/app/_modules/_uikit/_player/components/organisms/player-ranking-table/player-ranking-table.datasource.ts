import { BehaviorSubject } from 'rxjs';
import { DataSource } from '@angular/cdk/collections';
import { ScorerEntry } from '@floorball/models';

export class PlayerRankingTableDatasoure extends DataSource<ScorerEntry> {
  data = new BehaviorSubject<ScorerEntry[]>([]);

  connect() {
    return this.data;
  }

  disconnect() {
    // Stub
  }
}
