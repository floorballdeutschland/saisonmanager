import { Component, Input, OnInit } from '@angular/core';
import {
  Club,
  PlayerLicense,
  Player,
  TeamWithPlayers,
  PlayerWithLicense,
} from '@floorball/types';
import {
  ClubService,
  NotificationService,
  PlayerService,
} from '@floorball/core';

@Component({
  selector: 'fb-license-admin-detail',
  templateUrl: './license-admin-detail.component.html',
  styleUrls: ['./license-admin-detail.component.scss'],
})
export class LicenseAdminDetailComponent implements OnInit {
  @Input()
  initiallyOpen = false;

  @Input()
  player!: PlayerWithLicense;

  @Input()
  team!: TeamWithPlayers;

  @Input()
  allClubs!: Club[];

  @Input()
  license!: PlayerLicense;

  reasons: { [key: string]: string } = {};

  hidePlayer: { [key: number]: boolean } = {};

  open = false;

  constructor(
    private _playerService: PlayerService,
    private _notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.open = this.initiallyOpen;
  }

  public toggleDetails(): void {
    this.open = !this.open;
  }

  public getClubNameById(id: number): string {
    return this.allClubs.find((club) => club.id === id)?.name || '(unbekannt)';
  }

  public calculateAge(dateString: string): number {
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  public approveLicense(player: PlayerWithLicense) {
    const licenseId = player.team_license.license.id;

    this._playerService
      .updateLicenseStatus(player.id, licenseId, 1, this.reasons[licenseId])
      .subscribe({
        next: (_) => {
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
        next: (_) => {
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
}
