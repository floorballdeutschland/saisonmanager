import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService, OnlineTestService } from '@floorball/core';
import { OnlineTest } from '@floorball/types';

@Component({ templateUrl: './online-test-index.component.html' })
export class OnlineTestIndexComponent implements OnInit {
  tests: OnlineTest[] = [];
  loading = true;

  constructor(
    private _onlineTestService: OnlineTestService,
    private _notificationService: NotificationService,
    private _router: Router
  ) {}

  ngOnInit(): void {
    this._onlineTestService.adminGetAll().subscribe({
      next: (tests) => {
        this.tests = tests;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  goToTest(id: number): void {
    this._router.navigate(['/verwaltung', 'onlinepruefungen', id, 'fragen']);
  }

  deleteTest(event: MouseEvent, test: OnlineTest): void {
    event.stopPropagation();
    if (!confirm(`Prüfung „${test.name}“ wirklich löschen?`)) return;
    this._onlineTestService.adminDelete(test.id).subscribe({
      next: () => {
        this.tests = this.tests.filter((t) => t.id !== test.id);
        this._notificationService.success('Prüfung gelöscht.', {
          autoClose: true,
        });
      },
      error: () =>
        this._notificationService.error('Löschen fehlgeschlagen.', {
          autoClose: false,
        }),
    });
  }
}
