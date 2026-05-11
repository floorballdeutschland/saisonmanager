import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import {
  AssociationService,
  GameOperationService,
  LeagueService,
  StateAssociationService,
} from '@floorball/core';
import {
  GameOperation,
  GameOperationWithLeagues,
  StateAssociation,
} from '@floorball/types';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';

@Component({
  templateUrl: './league-index.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class LeagueIndexComponent implements OnInit {
  associations$: Observable<GameOperation[]>;

  goLeagueItems$?: Observable<GameOperationWithLeagues[]>;

  rootStateAssociations: StateAssociation[] = [];

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _gameOperationService: GameOperationService,
    private _stateAssociationService: StateAssociationService,
    private _metaTitle: Title
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this.goLeagueItems$ = this._leagueService.getAdminLeagues();
    this._stateAssociationService.adminGetAll().subscribe({
      next: (all) => {
        this.rootStateAssociations = all.filter((sa) => !sa.parent_id);
      },
    });
  }

  public updateStateAssociation(
    gameOperation: GameOperationWithLeagues,
    stateAssociationId: number | null
  ) {
    this._gameOperationService
      .updateAdminGameOperation(gameOperation.id, {
        state_association_id: stateAssociationId,
      })
      .subscribe({
        next: (updated) => {
          gameOperation.state_association_id = updated.state_association_id;
        },
      });
  }
}
