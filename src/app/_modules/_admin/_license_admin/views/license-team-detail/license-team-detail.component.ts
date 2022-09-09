import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { AssociationService, ClubService } from '@floorball/core';
import { GameOperation, LicenseHash } from 'src/app/_models';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { GameOperationWithClubs } from 'src/app/_models/game-operation.interface';
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
        next: (result) => {
          // reload user licenses
          this.loadUserLicenses();
        },
      });
  }

  public recreateLicenseRequest(playerId: number) {
    // check if set!
    this._clubService
      .userCreateLicenseRequest(playerId, this.teamId)
      .subscribe({
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
        next: (result) => {
          // reload user licenses
          this.loadUserLicenses();
        },
      });
  }
}
