import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { AssociationService, LeagueService } from '@floorball/core';
import { GameOperation, GameOperationWithLeagues } from '@floorball/types';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';

@Component({
  templateUrl: './league-index.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class LeagueIndexComponent implements OnInit {
  associations$: Observable<GameOperation[]>;

  goLeagueItems$?: Observable<GameOperationWithLeagues[]>;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _metaTitle: Title
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this.goLeagueItems$ = this._leagueService.getAdminLeagues();
  }
}
