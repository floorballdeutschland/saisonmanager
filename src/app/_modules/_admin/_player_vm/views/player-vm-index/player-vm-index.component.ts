import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
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
  standalone: false,
})
export class PlayerVmIndexComponent implements OnInit, OnDestroy {
  clubLists: ClubPlayerList[] = [];
  loading = false;
  actionError: string | null = null;
  confirmDeactivateId: number | null = null;
  deactivateReason = '';
  deactivateReasonOther = '';

  private _destroy$ = new Subject<void>();

  constructor(
    private _clubService: ClubService,
    private _playerService: PlayerService,
    private _cdr: ChangeDetectorRef,
    private _title: Title,
    private _transloco: TranslocoService
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

  toggleDeactivated(list: ClubPlayerList): void {
    list.showDeactivated = !list.showDeactivated;
    this._cdr.markForCheck();
  }

  startDeactivate(player: Player): void {
    this.confirmDeactivateId = player.id;
    this.deactivateReason = '';
    this.deactivateReasonOther = '';
    this.actionError = null;
    this._cdr.markForCheck();
  }

  cancelDeactivate(): void {
    this.confirmDeactivateId = null;
    this.deactivateReason = '';
    this.deactivateReasonOther = '';
    this._cdr.markForCheck();
  }

  deactivate(list: ClubPlayerList, player: Player): void {
    this.confirmDeactivateId = null;
    this.actionError = null;
    const reason =
      this.deactivateReason === 'Sonstiges'
        ? this._transloco.translate(
            'playerVm.notifications.reasonOtherPrefix',
            {
              detail: this.deactivateReasonOther,
            }
          )
        : this.deactivateReason;
    this._playerService
      .deactivatePlayer(player.id, reason)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          list.players = list.players.map((p) =>
            p.id === player.id ? updated : p
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.actionError =
            err?.error?.message ??
            this._transloco.translate('playerVm.notifications.deactivateError');
          this.deactivateReason = '';
          this.deactivateReasonOther = '';
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
          list.players = list.players.map((p) =>
            p.id === player.id ? updated : p
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.actionError =
            err?.error?.message ??
            this._transloco.translate('playerVm.notifications.reactivateError');
          this._cdr.markForCheck();
        },
      });
  }
}
