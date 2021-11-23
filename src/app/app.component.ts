import { Component } from '@angular/core';
import { AssociationService, LeagueService } from '@floorball/core';
import { Observable } from 'rxjs';
import { GameOperation, League } from '@floorball/types';

@Component({
  selector: 'fb-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'saisonmanager';

  isLoading$;
  leagues$: Observable<League[] | null>;
  selectedAssociation$: Observable<GameOperation | null>;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService
  ) {
    this.isLoading$ = this._associationService.associationsIsLoading$;

    this.leagues$ = this._leagueService.leagues$;
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
  }
}
