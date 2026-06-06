import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OnlineTestService } from '@floorball/core';
import { OnlineTest } from '@floorball/types';

@Component({
  templateUrl: './online-test-edit.component.html',
  standalone: false,
})
export class OnlineTestEditComponent implements OnInit {
  test: Partial<OnlineTest> = { max_attempts: 2 };
  isNew = true;
  saving = false;
  error: string | null = null;

  constructor(
    private _route: ActivatedRoute,
    private _router: Router,
    private _onlineTestService: OnlineTestService
  ) {}

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (id) {
      this.isNew = false;
      this._onlineTestService.adminGet(+id).subscribe({
        next: (t) => (this.test = { ...t }),
      });
    }
  }

  save(): void {
    this.saving = true;
    this.error = null;
    const obs = this.isNew
      ? this._onlineTestService.adminCreate(this.test)
      : this._onlineTestService.adminUpdate(this.test.id!, this.test);

    obs.subscribe({
      next: (saved) => {
        this._router.navigate([
          '/verwaltung',
          'onlinepruefungen',
          saved.id,
          'fragen',
        ]);
      },
      error: () => {
        this.saving = false;
        this.error = 'Speichern fehlgeschlagen.';
      },
    });
  }

  publish(): void {
    if (!this.test.id) return;
    this._onlineTestService.adminPublish(this.test.id).subscribe({
      next: (t) => (this.test = { ...t }),
    });
  }
}
