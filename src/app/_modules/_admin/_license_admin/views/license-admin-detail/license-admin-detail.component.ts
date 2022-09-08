import { Component, Input, OnInit } from '@angular/core';
import {
  Club,
  PlayerLicense,
  Player,
  TeamWithPlayers,
  PlayerWithLicense,
} from '@floorball/types';
import { ClubService } from '@floorball/core';

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

  open = false;

  constructor(private _clubService: ClubService) {}

  ngOnInit(): void {
    this.open = this.initiallyOpen;
  }

  public toggleDetails(): void {
    this.open = !this.open;
  }

  public getClubNameById(id: number): string {
    return this.allClubs.find((club) => club.id === id)?.name || '(unbekannt)';
  }

  // public getTeamById(id: number) {
  //   return this._clubService.getAdminTeam(id)
  // }
}
