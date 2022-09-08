import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import {
  Club,
  PlayerLicense,
  Player,
  TeamWithPlayers,
  PlayerWithLicense,
  Team,
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

  team?: Team;
  constructor(
    private _clubService: ClubService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._clubService.getAdminTeam(this.teamId).subscribe({
      next: (team) => {
        this.team = team;
        this._cdr.markForCheck();
      },
    });
  }
}
