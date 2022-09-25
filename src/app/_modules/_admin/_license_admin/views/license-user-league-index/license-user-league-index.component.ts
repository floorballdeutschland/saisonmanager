import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { LeagueService } from '@floorball/core';
import { GameOperationWithLeagues } from '@floorball/types';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'fb-license-user-index',
  templateUrl: './license-user-league-index.component.html',
})
export class LicenseUserLeagueIndexComponent implements OnInit {
  gameOperations: GameOperationWithLeagues[] = [];

  constructor(
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    this._metaTitle.setTitle('Floorball Saisonmanager Lizenzverwaltung');
  }

  ngOnInit(): void {
    this.getGameOperations();
  }

  public getGameOperations(): void {
    this._leagueService.getUserLeaguesLicenseIndex().subscribe({
      next: (gameOperations) => {
        this.gameOperations = gameOperations;

        this._cdr.markForCheck();
      },
    });
  }
}
