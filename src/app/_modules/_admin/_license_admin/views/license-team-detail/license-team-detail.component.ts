import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  GameOperation,
  LicenseHash,
  GameOperationWithClubs,
} from '@floorball/types';
import {
  AssociationService,
  ClubService,
  PlayerService,
} from '@floorball/core';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

@Component({
  templateUrl: './license-team-detail.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class LicenseTeamDetailComponent implements OnInit {
  associations$: Observable<GameOperation[]>;

  goClubItems$?: Observable<GameOperationWithClubs[]>;

  licenseHash!: LicenseHash;
  teamId = 0;
  playerId = 0;

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _playerService: PlayerService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle(
      'Floorball Saisonmanager Lizenzverwaltung (Team: )'
    );
  }

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      if (params['teamId']) {
        this.teamId = params['teamId'];
        this.loadUserLicenses();
      }
    });
  }

  public loadUserLicenses() {
    this._clubService.userGetTeamLicenses(this.teamId).subscribe({
      next: (result) => {
        this.licenseHash = result;

        this._cdr.markForCheck();
      },
    });
  }

  public createLicenseRequest() {
    // check if set!
    this._clubService
      .userCreateLicenseRequest(this.playerId, this.teamId)
      .subscribe({
        next: () => {
          // reload user licenses
          this.loadUserLicenses();
        },
      });
  }

  public recreateLicenseRequest(playerId: number, licenseId: string) {
    // check if set!
    this._playerService.reenableLicenseRequest(playerId, licenseId).subscribe({
      next: (result) => {
        // reload user licenses
        this.loadUserLicenses();
      },
    });
  }

  public withdrawRequest(playerId: number, licenseId: string) {
    this._clubService
      .userWithdrawLicenseRequest(playerId, licenseId)
      .subscribe({
        next: () => {
          // reload user licenses
          this.loadUserLicenses();
        },
      });
  }
}
