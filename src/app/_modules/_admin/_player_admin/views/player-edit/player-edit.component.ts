import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  NotificationService,
  PlayerService,
  SessionService,
} from '@floorball/core';
import { Player, Nation } from '@floorball/models';
import { Subject } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  templateUrl: './player-edit.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class PlayerEditComponent implements OnInit, OnDestroy {
  permissions: { [key: string]: any } = {};
  player?: Player;
  nations?: Nation[] = [];
  club_id?: number;

  editMode = true;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _playerService: PlayerService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _sessionService: SessionService,
    private _router: Router,
    private _notificationService: NotificationService,
    private _metaTitle: Title
  ) {
    this._metaTitle.setTitle('Floorball Saisonmanager Spielerverwaltung');
  }

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      this.club_id = params['clubId'];
      this.getNations();

      if (params['playerId']) {
        this.getPlayer(params['playerId']);
      } else {
        this.newPlayer();
      }
    });

    this._sessionService.currentUser$.subscribe({
      next: (user) => {
        this.permissions = user?.permissions || {};
      },
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  public getPlayer(id: string): void {
    this._playerService.getPlayer(parseInt(id)).subscribe({
      next: (result) => {
        this.player = result;

        this._cdr.markForCheck();
      },
    });
  }

  public getNations(): void {
    this._playerService.getNations().subscribe({
      next: (result) => {
        this.nations = result;

        this._cdr.markForCheck();
      },
    });
  }

  public newPlayer(): void {
    this.player = {
      id: 0,
      last_name: '',
      first_name: '',
      birthdate: '',
      male: true,
      nation_id: 0,
      club_id: this.club_id,
    };
  }

  public getPlayersNationString(): string {
    if (this.player?.nation_id && this.nations) {
      return this.nations[this.player.nation_id].name || '';
    }

    return '';
  }

  public canEdit(): boolean {
    return this.permissions['update_player'] || false;
  }

  public error(player: Player): boolean {
    return this.errorMsg(player).length > 0;
  }

  public errorMsg(player: Player): string[] {
    // eslint-disable-next-line prefer-const
    let msg = [];

    if (player.first_name.length < 1) {
      msg.push('Es muss ein Vorname gesetzt werden');
    }

    if (player.last_name.length < 1) {
      msg.push('Es muss ein Nachname gesetzt werden');
    }

    if (player.birthdate.length < 1) {
      msg.push('Es muss ein Geburtsdatum gesetzt werden');
    }

    if (player.nation_id <= 0) {
      msg.push('Es muss ein Nationalität gesetzt werden');
    }

    return msg;
  }

  public submit(player: Player) {
    const isNewPlayer = player.id === 0;

    this._playerService
      .adminCreateOrUpdatePlayer({ ...player, club_id: this.club_id })
      .subscribe({
        next: (result) => {
          const message = [
            isNewPlayer
              ? 'Spieler erfolgreich hinzugefügt.'
              : 'Spieler erfolgreich geändert.',
          ].join('');
          this._notificationService.success(message, {
            autoClose: true,
            keepAfterRouteChange: true,
          });
          this._router.navigate([
            '/',
            'verwaltung',
            'vereine',
            this.club_id,
            'spieler',
          ]);
        },
        error: (error) => {
          console.error(error, {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }
}
