import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OnlineTestService } from '@floorball/core';
import { RefereeOnlineTestDetail } from '@floorball/types';

@Component({
  templateUrl: './referee-online-test-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class RefereeOnlineTestDetailComponent implements OnInit {
  detail: RefereeOnlineTestDetail | null = null;
  starting = false;
  error: string | null = null;

  constructor(
    private _route: ActivatedRoute,
    private _router: Router,
    private _onlineTestService: OnlineTestService
  ) {}

  ngOnInit(): void {
    const id = +this._route.snapshot.paramMap.get('id')!;
    this._onlineTestService
      .refereeGet(id)
      .subscribe({ next: (d) => (this.detail = d) });
  }

  start(): void {
    if (!this.detail) return;
    this.starting = true;
    this._onlineTestService.refereeStart(this.detail.test.id).subscribe({
      next: () => {
        this._router.navigate([
          '/schiedsrichter',
          'onlinepruefungen',
          this.detail!.test.id,
          'pruefung',
        ]);
      },
      error: () => {
        this.starting = false;
        this.error = 'Prüfung konnte nicht gestartet werden.';
      },
    });
  }

  resume(): void {
    if (!this.detail) return;
    this._router.navigate([
      '/schiedsrichter',
      'onlinepruefungen',
      this.detail.test.id,
      'pruefung',
    ]);
  }
}
