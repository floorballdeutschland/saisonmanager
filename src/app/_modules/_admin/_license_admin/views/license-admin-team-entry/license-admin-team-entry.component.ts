import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { Team, PlayerLicenseHistory } from '@floorball/types';
import { ClubService } from '@floorball/core';

@Component({
  selector: 'fb-license-admin-team-entry',
  templateUrl: './license-admin-team-entry.component.html',
})
export class LicenseAdminTeamEntryComponent implements OnInit {
  @Input()
  teamId!: number;

  @Input()
  lastHistory!: PlayerLicenseHistory;

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
