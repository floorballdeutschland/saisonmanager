import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  Club,
  League,
  PlayerWithLicense,
  TeamWithPlayers,
} from '@floorball/types';
import { ClubService, LeagueService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'fb-license-user-league-detail',
  templateUrl: './license-user-league-detail.component.html',
  styleUrls: ['./license-user-league-detail.component.scss'],
})
export class LicenseUserLeagueDetailComponent implements OnInit {
  league?: League;
  teams: TeamWithPlayers[] = [];
  allClubs: Club[] = [];
  gamedayDate?: string;

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
      this._leagueService.getSingleLeague(params['leagueId']).subscribe({
        next: (league) => {
          this.league = league;
          this._cdr.markForCheck();
        },
      });
      this._leagueService.getUserLeagueLicenses(params['leagueId']).subscribe({
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

  public otherLicenseNames(p: PlayerWithLicense): string {
    return (p.other_licenses ?? []).map((l) => l.team_name).join(', ');
  }

  public currentTime() {
    return new Date();
  }

  public getAgeCategory(dateString: string): string {
    const age = this.calculateAge(dateString);

    if (age < 9) {
      return 'U9';
    } else if (age < 11) {
      return 'U11';
    } else if (age < 13) {
      return 'U13';
    } else if (age < 15) {
      return 'U15';
    } else if (age < 17) {
      return 'U17';
    } else if (age < 18) {
      return 'U18';
    } else if (age > 40) {
      return 'Ü40';
    } else if (age > 30) {
      return 'Ü30';
    } else {
      return '';
    }
  }

  public calculateAge(dateString: string): number {
    if (!this.gamedayDate) {
      return 0;
    }

    const parseLocalDate = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    const today = parseLocalDate(this.gamedayDate);
    const birthDate = parseLocalDate(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  public setGamedayDate(daysFromToday: number) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + daysFromToday);

    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const joined = [year, month, day].join('-');

    this.gamedayDate = joined;
  }
}
