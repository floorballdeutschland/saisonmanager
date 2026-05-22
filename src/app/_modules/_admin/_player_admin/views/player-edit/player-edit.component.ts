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
  PlayerChangeRequestService,
  PlayerService,
  SessionService,
} from '@floorball/core';
import {
  Club,
  CorrectionType,
  GenderKey,
  Nation,
  Player,
  PlayerLicense,
} from '@floorball/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { PLAYER_GENDERS } from '@floorball/types';

@Component({
  templateUrl: './player-edit.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class PlayerEditComponent implements OnInit, OnDestroy {
  permissions: { [key: string]: boolean } = {};
  player?: Player;
  nations?: Nation[] = [];
  allClubs: Club[] = [];
  club_id?: number;

  additionalClubId?: string = '0';
  transferClubId?: string = '0';

  editMode = true;
  confirmDeactivate = false;
  deactivateReason = '';
  deactivateReasonOther = '';

  changeRequestType: CorrectionType | '' = '';
  changeRequestValue = '';
  changeRequestSent = false;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _playerService: PlayerService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _sessionService: SessionService,
    private _clubService: ClubService,
    private _router: Router,
    private _notificationService: NotificationService,
    private _changeRequestService: PlayerChangeRequestService,
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
      gender: 'M',
      nation_id: 0,
      club_id: this.club_id,
    };
  }

  public getPlayersNationString(): string {
    const player = this.player;

    if (player && this.nations) {
      const foundNations = this.nations.filter(
        (n) => n.id === player.nation_id
      );
      return foundNations && foundNations.length > 0
        ? foundNations[0].name
        : '';
    }

    return '';
  }

  public get genderKeys(): GenderKey[] {
    // we need to cast the keys to GenderKey[] because Object.keys returns string[]
    return Object.keys(PLAYER_GENDERS) as GenderKey[];
  }

  public can(permissionString: string): boolean {
    let p = permissionString;

    if (p === 'player_create_update') {
      p = this.editMode ? 'update_player' : 'create_player';
    }

    return this.permissions[p] || false;
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
        next: () => {
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
          this._notificationService.error(error, {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  public addAdditionalClub(
    player: Player | undefined,
    clubId: string | undefined
  ) {
    this._playerService
      .adminAddAdditionalClub(player?.id || 0, clubId || '0')
      .subscribe({
        next: () => {
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
          this._notificationService.error(error, {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  public removeAdditionalClub(
    player: Player | undefined,
    clubId: string | undefined,
    valid_until: string | undefined
  ) {
    this._playerService
      .adminRemoveAdditionalClub(
        player?.id || 0,
        clubId || '0',
        valid_until || '0'
      )
      .subscribe({
        next: () => {
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
          this._notificationService.error(error, {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  public transfer(player: Player | undefined, clubId: string | undefined) {
    this._playerService
      .adminTransferPlayer(player?.id || 0, clubId || '0')
      .subscribe({
        next: () => {
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
          this._notificationService.error(error, {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  get isDeactivated(): boolean {
    return !!this.player?.deactivated_at;
  }

  get canDeactivate(): boolean {
    return (
      !this.isDeactivated && this.editMode && this.can('player_deactivate')
    );
  }

  public cancelDeactivate(): void {
    this.confirmDeactivate = false;
    this.deactivateReason = '';
    this.deactivateReasonOther = '';
  }

  public deactivatePlayer(): void {
    if (!this.player) return;
    const reason =
      this.deactivateReason === 'Sonstiges'
        ? `Sonstiges: ${this.deactivateReasonOther}`
        : this.deactivateReason;
    this._playerService
      .deactivatePlayer(this.player.id, reason)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.player = updated;
          this.cancelDeactivate();
          this._notificationService.success('Spieler wurde deaktiviert.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
        error: (err) => {
          this._notificationService.error(
            err?.error?.message ?? 'Deaktivierung fehlgeschlagen.',
            { autoClose: false, keepAfterRouteChange: false }
          );
          this.cancelDeactivate();
          this._cdr.markForCheck();
        },
      });
  }

  public saveEmail(): void {
    if (!this.player?.id || !this.player?.email) return;
    this._playerService
      .updatePlayerEmail(this.player.id, this.player.email ?? null)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success('E-Mail gespeichert.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
        },
        error: (err) => {
          this._notificationService.error(
            err?.error?.message ?? 'Fehler beim Speichern der E-Mail.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        },
      });
  }

  public setLicenseToTransfer(license: PlayerLicense) {
    const licenseId = license.id;

    if (this.player) {
      this._playerService
        .updateLicenseStatus(
          this.player.id,
          licenseId,
          6,
          'für Transfer ungültig gesetzt'
        )
        .subscribe({
          next: () => {
            this._notificationService.success(
              'Lizenz für Spieler ' +
                this.player?.first_name +
                ' ' +
                this.player?.last_name +
                ' (' +
                this.player?.id +
                ') für Transfer ungültig gesetzt',
              {
                autoClose: true,
                keepAfterRouteChange: false,
              }
            );
            this.getPlayer('' + this.player?.id);
          },
        });
    }
  }

  public onChangeRequestTypeChange(): void {
    this.changeRequestValue = '';
  }

  public submitChangeRequest(player: Player): void {
    if (!this.changeRequestType || !this.club_id || !player.id) return;

    const value =
      this.changeRequestType === 'names_swapped'
        ? undefined
        : this.changeRequestValue;

    this._changeRequestService
      .create(player.id, +this.club_id, this.changeRequestType, value)
      .subscribe({
        next: () => {
          this.changeRequestSent = true;
          this.changeRequestType = '';
          this.changeRequestValue = '';
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error(
            'Antrag konnte nicht eingereicht werden.',
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
      });
  }
}
