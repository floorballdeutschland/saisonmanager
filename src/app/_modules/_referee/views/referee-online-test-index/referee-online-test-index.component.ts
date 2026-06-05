import { Component, OnInit } from '@angular/core';
import { OnlineTestService } from '@floorball/core';
import { RefereeOnlineTestListItem } from '@floorball/types';

@Component({
  templateUrl: './referee-online-test-index.component.html',
  standalone: false,
})
export class RefereeOnlineTestIndexComponent implements OnInit {
  tests: RefereeOnlineTestListItem[] = [];
  loading = true;

  constructor(private _onlineTestService: OnlineTestService) {}

  ngOnInit(): void {
    this._onlineTestService.refereeGetAll().subscribe({
      next: (t) => {
        this.tests = t;
        this.loading = false;
      },
    });
  }

  statusLabel(test: RefereeOnlineTestListItem): string {
    if (test.has_in_progress) return 'Läuft';
    if (test.attempt_count === 0) return 'Offen';
    if (test.attempt_count >= test.max_attempts) return 'Abgeschlossen';
    return `${test.attempt_count}/${test.max_attempts} Versuche`;
  }
}
