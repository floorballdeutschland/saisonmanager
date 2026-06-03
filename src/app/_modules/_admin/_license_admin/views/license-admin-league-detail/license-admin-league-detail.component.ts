import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Club, League, TeamWithPlayers } from '@floorball/types';
import { ClubService, LeagueService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'fb-license-admin-league-detail',
  templateUrl: './license-admin-league-detail.component.html',
})
export class LicenseAdminLeagueDetailComponent implements OnInit, OnDestroy {
  teams: TeamWithPlayers[] = [];
  allClubs: Club[] = [];
  league?: League;
  private _leagueId?: number;

  handledPlayerIds: number[] = [];
  copyLoading = false;
  copyResult?: { copied: number };

  allOpen = false;
  toggleAll(): void {
    this.allOpen = !this.allOpen;
  }

  private _destroy$ = new Subject<void>();

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
    this._route.params.pipe(takeUntil(this._destroy$)).subscribe((params) => {
      const parsed = parseInt(params['leagueId'], 10);
      this._leagueId = Number.isNaN(parsed) ? undefined : parsed;
      this.getGameOperations();
    });
    this.getAllClubs();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public getGameOperations(): void {
    if (!this._leagueId) return;

    this._leagueService
      .getSingleLeague(this._leagueId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (league) => {
          this.league = league;
          this._cdr.markForCheck();
        },
      });

    this._leagueService
      .getAdminLeagueLicenses(this._leagueId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (teams) => {
          this.teams = teams;
          this._cdr.markForCheck();
        },
      });
  }

  public getAllClubs(): void {
    this._clubService
      .getAdminClubAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
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
    this._leagueService
      .copyPreroundLicenses(this.league.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
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

  public isMinor(birthdate?: string): boolean {
    if (!birthdate) return false;
    const dob = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
    ) {
      age--;
    }
    return age < 18;
  }
}
