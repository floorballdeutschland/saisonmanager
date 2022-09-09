import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Club, TeamWithPlayers } from '@floorball/types';
import { ClubService, LeagueService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'fb-license-admin-league-detail',
  templateUrl: './license-admin-league-detail.component.html',
  styleUrls: ['./license-admin-league-detail.component.scss'],
})
export class LicenseAdminLeagueDetailComponent implements OnInit {
  teams: TeamWithPlayers[] = [];
  allClubs: Club[] = [];

  handledPlayerIds: number[] = [];

  constructor(
    private _leagueService: LeagueService,
    private _clubService: ClubService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    this._metaTitle.setTitle('Floorball Saisonmanager Lizenzverwaltung');
  }

  ngOnInit(): void {
    this.getGameOperations();
    this.getAllClubs();
  }

  public getGameOperations(): void {
    this._route.params.subscribe((params) => {
      this._leagueService.getAdminLeagueLicenses(params['leagueId']).subscribe({
        next: (teams) => {
          this.teams = teams;

          this._cdr.markForCheck();
        },
      });
    });
  }

  public getAllClubs(): void {
    this._clubService.getAdminClubAll().subscribe({
      next: (result) => {
        this.allClubs = result;
        this._cdr.markForCheck();
      },
    });
  }

  public handledPlayer(playerId: number) {
    this.handledPlayerIds.push(playerId);
  }
}
