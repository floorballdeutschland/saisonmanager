import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, take, takeUntil } from 'rxjs';
import {
  NotificationService,
  PlayerService,
  SessionService,
} from '@floorball/core';
import { Player, PlayerSearchResult } from '@floorball/models';

@Component({
  templateUrl: './player-merge.component.html',
})
export class PlayerMergeComponent implements OnInit, OnDestroy {
  master?: Player;
  secondary?: PlayerSearchResult;
  searchQuery = '';
  searchResults: PlayerSearchResult[] = [];
  step: 1 | 2 | 3 = 1;
  loading = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _router: Router,
    private _playerService: PlayerService,
    private _notificationService: NotificationService,
    private _sessionService: SessionService
  ) {}

  ngOnInit(): void {
    const id = Number(this._route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this._router.navigate(['/', 'verwaltung', 'spieler', 'suche']);
      return;
    }
    this._sessionService.currentUser$
      .pipe(take(1), takeUntil(this._destroy$))
      .subscribe((user) => {
        if (!user?.permissions['player_merge']) {
          this._router.navigate(['/', 'verwaltung', 'spieler', 'suche']);
          return;
        }
        this._playerService
          .getPlayer(id)
          .pipe(takeUntil(this._destroy$))
          .subscribe({
            next: (p) => (this.master = p),
            error: () =>
              this._router.navigate(['/', 'verwaltung', 'spieler', 'suche']),
          });
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  search(): void {
    if (!this.searchQuery.trim() || !this.master) return;
    const masterId = this.master.id;
    this._playerService
      .globalSearch(this.searchQuery)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (results) => {
          this.searchResults = results.filter((r) => r.id !== masterId);
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
    const master = this.master;
    this._playerService
      .mergePlayer(master.id, this.secondary.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success(
            'Spieler erfolgreich zusammengeführt.',
            { autoClose: true, keepAfterRouteChange: true }
          );
          this._router.navigate([
            '/',
            'verwaltung',
            'vereine',
            master.club_id ?? 'alle',
            'spieler',
            master.id,
            'bearbeiten',
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
