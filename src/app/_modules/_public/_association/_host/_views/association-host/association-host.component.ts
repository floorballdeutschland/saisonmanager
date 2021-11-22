import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AssociationService, LeagueService } from '@floorball/core';
import { GameOperation, League } from '@floorball/types';
import { Observable } from 'rxjs';

@Component({
  templateUrl: './association-host.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AssociationHostComponent implements OnInit {
  selectedAssociation$!: Observable<GameOperation | null>;
  association$!: Observable<GameOperation[]>;
  leagues$?: Observable<League[] | null>;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.selectedAssociation$ = this._associationService.selectedAssociation$;

    this.association$ = this._associationService.associations$;
    this._associationService.selectAssociation(this._route);
    this.leagues$ = this._leagueService.leagues$;
  }
}
