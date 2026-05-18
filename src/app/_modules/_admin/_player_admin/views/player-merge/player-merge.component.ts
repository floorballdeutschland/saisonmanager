import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  NotificationService,
  PlayerService,
  SessionService,
} from '@floorball/core';
import { Player, PlayerSearchResult } from '@floorball/models';

@Component({
  templateUrl: './player-merge.component.html',
})
export class PlayerMergeComponent implements OnInit {
  master?: Player;
  secondary?: PlayerSearchResult;
  searchQuery = '';
  searchResults: PlayerSearchResult[] = [];
  step: 1 | 2 | 3 = 1;
  loading = false;

  constructor(
    private _route: ActivatedRoute,
    private _router: Router,
    private _playerService: PlayerService,
    private _notificationService: NotificationService,
    private _sessionService: SessionService
  ) {}

  ngOnInit(): void {
    const permissions = this._sessionService.currentUser?.permissions ?? {};
    if (!permissions['player_merge']) {
      this._router.navigate(['/', 'verwaltung', 'spieler']);
      return;
    }
    const id = Number(this._route.snapshot.paramMap.get('id'));
    this._playerService.getPlayer(id).subscribe({
      next: (p) => (this.master = p),
      error: () => this._router.navigate(['/', 'verwaltung', 'spieler']),
    });
  }

  search(): void {
    if (!this.searchQuery.trim()) return;
    this._playerService.globalSearch(this.searchQuery).subscribe({
      next: (results) => {
        this.searchResults = results.filter((r) => r.id !== this.master?.id);
      },
    });
  }

  selectSecondary(player: PlayerSearchResult): void {
    this.secondary = player;
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
    this._playerService
      .mergePlayer(this.master.id, this.secondary.id)
      .subscribe({
        next: () => {
          this._notificationService.success(
            'Spieler erfolgreich zusammengeführt.',
            { autoClose: true, keepAfterRouteChange: true }
          );
          this._router.navigate([
            '/',
            'verwaltung',
            'spieler',
            this.master!.id,
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
