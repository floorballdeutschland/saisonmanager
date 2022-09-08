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
  selector: 'fb-license-admin-team-entry',
  templateUrl: './license-admin-team-entry.component.html',
  styleUrls: ['./license-admin-team-entry.component.scss'],
})
export class LicenseAdminTeamEntryComponent implements OnInit {
  @Input()
  teamId!: number;
  constructor(private _clubService: ClubService) {}

  ngOnInit(): void {
    this._clubService.getAdminTeam(this.teamId).subscribe({
      next: (result) => {
        console.log(result);
      },
    });
  }
}
