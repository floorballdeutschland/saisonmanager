import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Club, League, TeamWithPlayers } from '@floorball/types';
import { ClubService, LeagueService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'fb-license-admin-league-detail',
  templateUrl: './license-admin-league-detail.component.html',
})
export class LicenseAdminLeagueDetailComponent implements OnInit {
  teams: TeamWithPlayers[] = [];
  allClubs: Club[] = [];
  league?: League;

  handledPlayerIds: number[] = [];
  copyLoading = false;
  copyResult?: { copied: number };

  allOpen = false;
  toggleAll(): void {
    this.allOpen = !this.allOpen;
  }

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
      const leagueId = params['leagueId'];

      this._leagueService.getSingleLeague(+leagueId).subscribe({
        next: (league) => {
          this.league = league;
          this._cdr.markForCheck();
        },
      });

      this._leagueService.getAdminLeagueLicenses(leagueId).subscribe({
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
    this.getGameOperations();
  }

  public copyPreroundLicenses(): void {
    if (!this.league?.id) return;
    this.copyLoading = true;
    this.copyResult = undefined;
    this._leagueService.copyPreroundLicenses(this.league.id).subscribe({
      next: (result) => {
        this.copyResult = result;
        this.copyLoading = false;
        this.getGameOperations();
        this._cdr.markForCheck();
      },
      error: () => {
        this.copyLoading = false;
        this._cdr.markForCheck();
      },
    });
  }
}
