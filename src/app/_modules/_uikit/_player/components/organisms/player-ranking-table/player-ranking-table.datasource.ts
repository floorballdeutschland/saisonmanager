import { BehaviorSubject } from 'rxjs';
import { DataSource } from '@angular/cdk/collections';

export class PlayerRankingTableDatasoure extends DataSource<unknown> {
  data = new BehaviorSubject<unknown[]>([]);

  connect() {
    return this.data;
  }

  disconnect() {
    // Stub
  }
}
