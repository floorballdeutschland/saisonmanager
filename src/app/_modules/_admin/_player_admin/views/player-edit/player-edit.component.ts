import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
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
  GfRole,
  Nation,
  Player,
  PlayerLicense,
  PlayerSuspension,
} from '@floorball/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { PLAYER_GENDERS } from '@floorball/types';

@Component({
  templateUrl: './player-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PlayerEditComponent implements OnInit, OnDestroy {
  permissions: { [key: string]: boolean } = {};
  player?: Player;
  nations?: Nation[] = [];
  allClubs: Club[] = [];
  club_id?: number;

  additionalClubId?: string = '0';

  editMode = true;
  confirmDeactivate = false;
  deactivateReason = '';
  deactivateReasonOther = '';

  changeRequestType: CorrectionType | '' = '';
  changeRequestValue = '';
  changeRequestSent = false;

  suspensions: PlayerSuspension[] = [];
  // Ebene 1: id der Lizenz, für die gerade das Sperr-Formular offen ist
  suspendLicenseId: string | null = null;
  licenseSuspendUntil = '';
  licenseSuspendReason = '';
  // Ebene 2: Beantragungssperre
  showApplicationBlockForm = false;
  blockFrom = '';
  blockUntil = '';
  blockReason = '';

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
        this.loadSuspensions();

        this._cdr.markForCheck();
      },
    });
  }

  public loadSuspensions(): void {
    if (!this.player?.id || !this.can('player_suspend')) return;

    this._playerService.getSuspensions(this.player.id).subscribe({
      next: (result) => {
        this.suspensions = result;
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

  get isDeactivated(): boolean {
    return !!this.player?.deactivated_at;
  }

  get canDeactivate(): boolean {
    return (
      !this.isDeactivated && this.editMode && this.can('player_deactivate')
    );
  }

  get canReactivate(): boolean {
    return this.isDeactivated && this.editMode && this.can('player_deactivate');
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

  public reactivatePlayer(): void {
    if (!this.player) return;
    this._playerService
      .reactivatePlayer(this.player.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.player = updated;
          this._notificationService.success('Spieler wurde reaktiviert.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this._cdr.markForCheck();
        },
        error: (err) => {
          this._notificationService.error(
            err?.error?.message ?? 'Reaktivierung fehlgeschlagen.',
            { autoClose: false, keepAfterRouteChange: false }
          );
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

  // --- Erst-/Zweitlizenz-Zuordnung (GF-Erwachsenenbereich) -----------------

  public isGfAdultLicense(license: PlayerLicense): boolean {
    const league = license.league;
    if (!league || league.field_size !== 'GF') return false;
    // Jugendligen (U19/U17/…) kennen keine Erst-/Zweitlizenz.
    return !/^U\d/.test(league.age_group ?? '');
  }

  public isActiveLicense(license: PlayerLicense): boolean {
    const last = license.history?.[license.history.length - 1];
    return last?.license_status_id === 1 || last?.license_status_id === 2;
  }

  // Weitere aktive Lizenzen im selben GF-Erwachsenen-Wettbewerb
  // (gleiche Saison, gleiches female-Flag der Liga).
  public gfPartnerLicenses(license: PlayerLicense): PlayerLicense[] {
    return (this.player?.licenses ?? []).filter(
      (l) =>
        l.id !== license.id &&
        String(l.season_id) === String(license.season_id) &&
        this.isActiveLicense(l) &&
        this.isGfAdultLicense(l) &&
        l.league?.female === license.league?.female
    );
  }

  public gfRoleEditable(license: PlayerLicense): boolean {
    if (!this.can('player_set_gf_role')) return false;
    if (!this.isGfAdultLicense(license) || !this.isActiveLicense(license))
      return false;
    return !!license.gf_role || this.gfPartnerLicenses(license).length > 0;
  }

  // Bereits erfolgte Täusche in diesem Wettbewerb (jeder Tausch schreibt einen
  // 'swap'-Eintrag auf die gewechselte Lizenz).
  public gfSwapCount(license: PlayerLicense): number {
    return Math.max(
      ...[license, ...this.gfPartnerLicenses(license)].map(
        (l) =>
          (l.gf_role_history ?? []).filter((h) => h.source === 'swap').length
      )
    );
  }

  public setGfRole(license: PlayerLicense, role: GfRole | null): void {
    if (!this.player?.id) return;
    this._playerService
      .setGfLicenseRole(this.player.id, license.id, role)
      .subscribe({
        next: () => {
          this._notificationService.success(
            'Erst-/Zweitlizenz-Zuordnung aktualisiert.',
            { autoClose: true, keepAfterRouteChange: false }
          );
          this.getPlayer('' + this.player?.id);
        },
        // Der globale ErrorInterceptor zeigt 422 nicht an – Meldung (z. B.
        // Tausch-Limit) hier explizit ausgeben.
        error: (err) => {
          this._notificationService.error(
            err?.error?.message ?? 'Zuordnung konnte nicht geändert werden.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        },
      });
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

  // --- Spielersperren (Issue #508) ---------------------------------------

  public today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public get activeSuspensions(): PlayerSuspension[] {
    return this.suspensions.filter((s) => s.active);
  }

  public get hasApplicationBlock(): boolean {
    return this.activeSuspensions.some((s) => s.kind === 'application_block');
  }

  public isLicenseSuspended(license: PlayerLicense): boolean {
    return this.activeSuspensions.some((s) => s.team_id === license.team_id);
  }

  public openLicenseSuspend(license: PlayerLicense): void {
    this.suspendLicenseId = license.id;
    this.licenseSuspendUntil = '';
    this.licenseSuspendReason = '';
  }

  public cancelLicenseSuspend(): void {
    this.suspendLicenseId = null;
    this.licenseSuspendUntil = '';
    this.licenseSuspendReason = '';
  }

  public submitLicenseSuspend(license: PlayerLicense): void {
    if (!this.player?.id || !this.licenseSuspendUntil) return;

    this._playerService
      .createSuspension(this.player.id, {
        team_id: license.team_id,
        valid_until: this.licenseSuspendUntil,
        reason: this.licenseSuspendReason || null,
      })
      .subscribe({
        next: () => {
          this._notificationService.success('Lizenz wurde gesperrt.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this.cancelLicenseSuspend();
          this.getPlayer('' + this.player?.id);
        },
        error: (err) => {
          this._notificationService.error(
            err?.error?.message ?? 'Sperre konnte nicht gesetzt werden.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        },
      });
  }

  public openApplicationBlock(): void {
    this.showApplicationBlockForm = true;
    this.blockFrom = this.today();
    this.blockUntil = '';
    this.blockReason = '';
  }

  public cancelApplicationBlock(): void {
    this.showApplicationBlockForm = false;
    this.blockFrom = '';
    this.blockUntil = '';
    this.blockReason = '';
  }

  public submitApplicationBlock(): void {
    if (!this.player?.id || !this.blockUntil) return;

    this._playerService
      .createSuspension(this.player.id, {
        team_id: null,
        valid_from: this.blockFrom || null,
        valid_until: this.blockUntil,
        reason: this.blockReason || null,
      })
      .subscribe({
        next: () => {
          this._notificationService.success(
            'Beantragungssperre wurde eingerichtet. Alle aktiven Lizenzen wurden gesperrt.',
            { autoClose: true, keepAfterRouteChange: false }
          );
          this.cancelApplicationBlock();
          this.getPlayer('' + this.player?.id);
        },
        error: (err) => {
          this._notificationService.error(
            err?.error?.message ?? 'Sperre konnte nicht gesetzt werden.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        },
      });
  }

  public liftSuspension(suspension: PlayerSuspension): void {
    if (!this.player?.id) return;

    this._playerService
      .liftSuspension(this.player.id, suspension.id)
      .subscribe({
        next: () => {
          this._notificationService.success('Sperre wurde aufgehoben.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
          this.getPlayer('' + this.player?.id);
        },
        error: (err) => {
          this._notificationService.error(
            err?.error?.message ?? 'Sperre konnte nicht aufgehoben werden.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        },
      });
  }
}
