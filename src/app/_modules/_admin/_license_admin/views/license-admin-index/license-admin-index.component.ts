import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { LeagueService, PlayerService, SessionService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { League } from '@floorball/types';
import { GameOperationWithLeagues } from '../../../../../_models/game-operation.interface';

@Component({
  selector: 'fb-license-admin-index',
  templateUrl: './license-admin-index.component.html',
  styleUrls: ['./license-admin-index.component.scss'],
})
export class LicenseAdminIndexComponent implements OnInit {
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
    this._leagueService.getAdminLeagues().subscribe({
      next: (gameOperations) => {
        this.gameOperations = gameOperations;

        this._cdr.markForCheck();
      },
    });
  }
}
