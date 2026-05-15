import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { ClubService, PlayerService } from '@floorball/core';
import { ClubWithTeams, Player } from '@floorball/types';
import { Title } from '@angular/platform-browser';

interface ClubPlayerList {
  club: ClubWithTeams;
  players: Player[];
  showDeactivated: boolean;
}

@Component({
  templateUrl: './player-vm-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerVmIndexComponent implements OnInit, OnDestroy {
  clubLists: ClubPlayerList[] = [];
  loading = false;
  actionError: string | null = null;

  private _destroy$ = new Subject<void>();

  constructor(
    private _clubService: ClubService,
    private _playerService: PlayerService,
    private _cdr: ChangeDetectorRef,
    private _title: Title
  ) {
    this._title.setTitle('Floorball Saisonmanager Spielerliste (Verein)');
  }

  ngOnInit(): void {
    this.loading = true;
    this._clubService
      .adminGetClubAndTeams()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (clubs) => {
          if (!clubs.length) {
            this.loading = false;
            this._cdr.markForCheck();
            return;
          }
          forkJoin(
            clubs.map((club) => this._playerService.vmGetPlayers(club.id))
          )
            .pipe(takeUntil(this._destroy$))
            .subscribe({
              next: (playerLists) => {
                this.clubLists = clubs.map((club, i) => ({
                  club,
                  players: playerLists[i],
                  showDeactivated: false,
                }));
                this.loading = false;
                this._cdr.markForCheck();
              },
              error: () => {
                this.loading = false;
                this._cdr.markForCheck();
              },
            });
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  visiblePlayers(list: ClubPlayerList): Player[] {
    return list.showDeactivated
      ? list.players
      : list.players.filter((p) => !p.deactivated_at);
  }

  deactivatedCount(list: ClubPlayerList): number {
    return list.players.filter((p) => p.deactivated_at).length;
  }

  deactivate(list: ClubPlayerList, player: Player): void {
    this.actionError = null;
    this._playerService
      .deactivatePlayer(player.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          const idx = list.players.findIndex((p) => p.id === player.id);
          if (idx !== -1) list.players[idx] = updated;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.actionError =
            err?.error?.message ?? 'Deaktivierung fehlgeschlagen.';
          this._cdr.markForCheck();
        },
      });
  }

  reactivate(list: ClubPlayerList, player: Player): void {
    this.actionError = null;
    this._playerService
      .reactivatePlayer(player.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          const idx = list.players.findIndex((p) => p.id === player.id);
          if (idx !== -1) list.players[idx] = updated;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.actionError =
            err?.error?.message ?? 'Reaktivierung fehlgeschlagen.';
          this._cdr.markForCheck();
        },
      });
  }
}
