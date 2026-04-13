import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { PlayerService } from '@floorball/core';
import { PlayerStats } from '@floorball/types';
import { Subject, takeUntil } from 'rxjs';

@Component({
  templateUrl: './player-stats.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerStatsComponent implements OnInit, OnDestroy {
  stats?: PlayerStats;
  loading = true;
  error = false;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _route: ActivatedRoute,
    private _playerService: PlayerService,
    private _cdr: ChangeDetectorRef,
    private _title: Title
  ) {}

  ngOnInit(): void {
    this._route.paramMap.pipe(takeUntil(this._destroy$)).subscribe((params) => {
      const id = Number(params.get('playerId'));
      if (!id) return;
      this.loading = true;
      this._playerService
        .getPlayerStats(id)
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (data) => {
            this.stats = data;
            this.loading = false;
            this._title.setTitle(
              `${data.player.first_name} ${data.player.last_name} – Statistiken | Floorball Saisonmanager`
            );
            this._cdr.markForCheck();
          },
          error: () => {
            this.error = true;
            this.loading = false;
            this._cdr.markForCheck();
          },
        });
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  get totalGoals(): number {
    return this.stats?.totals.goals ?? 0;
  }

  get totalAssists(): number {
    return this.stats?.totals.assists ?? 0;
  }

  get totalGames(): number {
    return this.stats?.totals.games ?? 0;
  }

  get scorerPerGame(): string {
    return this.stats?.totals.scorer_per_game.toFixed(2) ?? '0.00';
  }
}
