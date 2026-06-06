import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import {
  Club,
  PlayerLicense,
  PlayerWithLicense,
  TeamWithPlayers,
} from '@floorball/types';
import { NotificationService, PlayerService } from '@floorball/core';

@Component({
  selector: 'fb-license-admin-detail',
  templateUrl: './license-admin-detail.component.html',
  standalone: false,
})
export class LicenseAdminDetailComponent implements OnInit {
  @Input()
  initiallyOpen = false;

  @Input() set forceOpen(val: boolean) {
    this.open = val;
  }

  @Input()
  player!: PlayerWithLicense;

  @Input()
  team!: TeamWithPlayers;

  @Input()
  allClubs!: Club[];

  @Input()
  license!: PlayerLicense;

  @Output() handledPlayer = new EventEmitter<number>();

  reasons: { [key: string]: string } = {};
  validUntilDates: { [key: string]: string } = {};

  hidePlayer: { [key: number]: boolean } = {};

  open = false;

  constructor(
    private _playerService: PlayerService,
    private _notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.open = this.initiallyOpen;
    const licenseId = this.player?.team_license?.license?.id;
    if (licenseId) {
      this.validUntilDates[licenseId] = this.defaultValidUntil();
    }
  }

  public toggleDetails(): void {
    this.open = !this.open;
  }

  public getClubNameById(id: number): string {
    return this.allClubs.find((club) => club.id === id)?.name || '(unbekannt)';
  }

  public calculateAge(dateString: string): number {
    const today = new Date();
    const [y, m, d] = dateString.split('-').map(Number);
    const birthDate = new Date(y, m - 1, d);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  }

  public defaultValidUntil(): string {
    const now = new Date();
    const year =
      now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
    return `${year}-07-31`;
  }

  public approveLicense(player: PlayerWithLicense) {
    const licenseId = player.team_license.license.id;
    const validUntil =
      this.validUntilDates[licenseId] || this.defaultValidUntil();

    this._playerService
      .updateLicenseStatus(
        player.id,
        licenseId,
        1,
        this.reasons[licenseId],
        validUntil
      )
      .subscribe({
        next: () => {
          this.handledPlayer.emit(player.id);
          this.hidePlayer[player.id] = true;
          this._notificationService.success(
            'Lizenz für Spieler ' +
              player.first_name +
              ' ' +
              player.last_name +
              ' (' +
              player.id +
              ') erteilt',
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
      });
  }

  public cancelLicense(player: PlayerWithLicense) {
    const licenseId = player.team_license.license.id;

    this._playerService
      .updateLicenseStatus(player.id, licenseId, 3, this.reasons[licenseId])
      .subscribe({
        next: () => {
          this.handledPlayer.emit(player.id);
          this.hidePlayer[player.id] = true;
          this._notificationService.success(
            'Lizenzantrag für Spieler ' +
              player.first_name +
              ' ' +
              player.last_name +
              ' (' +
              player.id +
              ') abgelehnt',
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
      });
  }

  public isDocumentsComplete(player: PlayerWithLicense): boolean {
    const docs = player.team_license?.documents;
    if (docs?.['id_copy'] === false) return false;
    const isMinor = player.birthdate
      ? this.calculateAge(player.birthdate) < 18
      : false;
    return !isMinor || !!docs?.parental_consent;
  }

  public resetLicenseToPending(player: PlayerWithLicense) {
    const licenseId = player.team_license.license.id;

    this._playerService
      .updateLicenseStatus(player.id, licenseId, 2, this.reasons[licenseId])
      .subscribe({
        next: () => {
          this.handledPlayer.emit(player.id);
          this.hidePlayer[player.id] = true;
          this._notificationService.success(
            'Lizenz für Spieler ' +
              player.first_name +
              ' ' +
              player.last_name +
              ' (' +
              player.id +
              ') auf "beantragt" zurückgesetzt',
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
      });
  }
}
