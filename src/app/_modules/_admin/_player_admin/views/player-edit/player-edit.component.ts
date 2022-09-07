import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  ClubService,
  NotificationService,
  PlayerService,
  SessionService,
} from '@floorball/core';
import { Player, Nation, Club } from '@floorball/models';
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
  allClubs: Club[] = [];
  club_id?: number;

  additionalClubId?: string = '0';
  transferClubId?: string = '0';

  editMode = true;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _playerService: PlayerService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _sessionService: SessionService,
    private _clubService: ClubService,
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
      this.getAllClubs();

      if (params['playerId']) {
        this.getPlayer(params['playerId']);
      } else {
        this.editMode = false;
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

  public additionalClubs() {
    return this.player?.clubs?.filter((club) => !club.home_club) || [];
  }

  public homeClubs() {
    return this.player?.clubs?.filter((club) => club.home_club) || [];
  }

  public getNations(): void {
    this._playerService.getNations().subscribe({
      next: (result) => {
        this.nations = result;

        this._cdr.markForCheck();
      },
    });
  }

  public getAllClubs(): void {
    this._clubService.getAdminClubAll().subscribe({
      next: (result) => {
        this.allClubs = result.sort((a, b) => {
          if (a.name <= b.name) {
            return -1;
          }
          if (a.name > b.name) {
            return 1;
          }

          return 0;
        });

        this._cdr.markForCheck();
      },
    });
  }

  public isAdditionalClubActive(clubId: number | undefined): boolean {
    return (
      (this.player?.clubs || []).findIndex((club) => {
        const validUntil = new Date(club.valid_until || '');
        const now = new Date(Date.now());
        return club.club_id === clubId && validUntil >= now;
      }) >= 0
    );
  }

  public isHomeClub(clubId: number | undefined): boolean {
    return (
      (this.player?.clubs || []).findIndex((club) => {
        const validUntil = new Date(club.valid_until || '');
        const now = new Date(Date.now());
        return (
          club.club_id === clubId &&
          club.home_club &&
          (!club.valid_until || validUntil >= now)
        );
      }) >= 0
    );
  }

  public getClubNameById(id: number): string {
    return this.allClubs.find((club) => club.id === id)?.name || '(unbekannt)';
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

  public can(permissionString: string): boolean {
    return this.permissions[permissionString] || false;
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

  public addAdditionalClub(player: Player | undefined, clubId: any) {
    this._playerService
      .adminAddAdditionalClub(player?.id || 0, clubId || '0')
      .subscribe({
        next: (result) => {
          const message = 'Spieler wurde erfolgreich freigegeben.';
          this._notificationService.success(message, {
            autoClose: true,
            keepAfterRouteChange: true,
          });
          if (player?.id) {
            this.getPlayer(player.id.toString());
          }
        },
        error: (error) => {
          console.error(error, {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  public transfer(player: Player | undefined, clubId: any) {
    this._playerService
      .adminTransferPlayer(player?.id || 0, clubId || '0')
      .subscribe({
        next: (result) => {
          const message = 'Spieler wurde erfolgreich transferiert.';
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
