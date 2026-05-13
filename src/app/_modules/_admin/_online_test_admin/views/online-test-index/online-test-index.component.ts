import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OnlineTestService } from '@floorball/core';
import { OnlineTest } from '@floorball/types';

@Component({ templateUrl: './online-test-index.component.html' })
export class OnlineTestIndexComponent implements OnInit {
  tests: OnlineTest[] = [];
  loading = true;

  constructor(
    private _onlineTestService: OnlineTestService,
    private _router: Router
  ) {}

  ngOnInit(): void {
    this._onlineTestService.adminGetAll().subscribe({
      next: (tests) => {
        this.tests = tests;
        this.loading = false;
      },
    });
  }

  goToTest(id: number): void {
    this._router.navigate(['/verwaltung', 'onlinepruefungen', id, 'fragen']);
  }
}
