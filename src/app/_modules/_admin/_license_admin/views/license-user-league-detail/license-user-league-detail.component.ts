import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Club, League, TeamWithPlayers } from '@floorball/types';
import { ClubService, LeagueService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'fb-license-user-league-detail',
  templateUrl: './license-user-league-detail.component.html',
  styleUrls: ['./license-user-league-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
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
    private _metaTitle: Title,
    private _transloco: TranslocoService
  ) {
    this._metaTitle.setTitle(
      this._transloco.translate('licenseAdmin.userLeagueDetail.metaTitle')
    );
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

  public currentTime() {
    return new Date();
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
