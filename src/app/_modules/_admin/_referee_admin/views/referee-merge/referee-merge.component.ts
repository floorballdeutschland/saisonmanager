import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  NotificationService,
  RefereeService,
  SessionService,
} from '@floorball/core';
import { RefereeAdmin } from '@floorball/types';

@Component({
  templateUrl: './referee-merge.component.html',
})
export class RefereeMergeComponent implements OnInit {
  master?: RefereeAdmin;
  secondary?: RefereeAdmin;
  searchQuery = '';
  searchResults: RefereeAdmin[] = [];
  step: 1 | 2 | 3 = 1;
  loading = false;

  constructor(
    private _route: ActivatedRoute,
    private _router: Router,
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _sessionService: SessionService
  ) {}

  ngOnInit(): void {
    const permissions = this._sessionService.currentUser?.permissions ?? {};
    if (!permissions['referee_merge']) {
      this._router.navigate(['/', 'verwaltung', 'schiedsrichter']);
      return;
    }
    const param: string = this._route.snapshot.params['lizenznummer'] ?? '';
    this._loadMaster(param);
  }

  private _loadMaster(param: string): void {
    if (param.startsWith('G-')) {
      const id = parseInt(param.slice(2), 10);
      this._refereeService.adminGetById(id).subscribe({
        next: (r) => (this.master = r),
        error: () =>
          this._router.navigate(['/', 'verwaltung', 'schiedsrichter']),
      });
    } else {
      const lizenznummer = parseInt(param, 10);
      this._refereeService.adminGetAll({ q: param }).subscribe({
        next: (results) => {
          const match = results.find((r) => r.lizenznummer === lizenznummer);
          if (!match) {
            this._router.navigate(['/', 'verwaltung', 'schiedsrichter']);
            return;
          }
          this._refereeService.adminGetById(match.id).subscribe({
            next: (r) => (this.master = r),
            error: () =>
              this._router.navigate(['/', 'verwaltung', 'schiedsrichter']),
          });
        },
        error: () =>
          this._router.navigate(['/', 'verwaltung', 'schiedsrichter']),
      });
    }
  }

  search(): void {
    if (!this.searchQuery.trim()) return;
    this._refereeService.adminGetAll({ q: this.searchQuery }).subscribe({
      next: (results) => {
        this.searchResults = results.filter((r) => r.id !== this.master?.id);
      },
    });
  }

  selectSecondary(referee: RefereeAdmin): void {
    this.secondary = referee;
    this.step = 2;
  }

  confirm(): void {
    this.step = 3;
  }

  cancelConfirm(): void {
    this.step = 2;
  }

  merge(): void {
    if (!this.master || !this.secondary) return;
    this.loading = true;
    this._refereeService
      .adminMerge(this.master.id, this.secondary.id)
      .subscribe({
        next: () => {
          this._notificationService.success(
            'Schiedsrichter erfolgreich zusammengeführt.',
            { autoClose: true, keepAfterRouteChange: true }
          );
          this._router.navigate([
            '/',
            'verwaltung',
            'schiedsrichter',
            this.master!.lizenznummer_display,
          ]);
        },
        error: (err) => {
          this.loading = false;
          this._notificationService.error(
            err?.error?.message ?? 'Fehler beim Zusammenführen.'
          );
        },
      });
  }

  back(): void {
    this.step = 1;
    this.secondary = undefined;
    this.searchResults = [];
  }
}
