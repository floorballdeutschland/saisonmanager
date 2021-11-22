import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AssociationService, LeagueService } from '@floorball/core';
import { GameOperation, League } from '@floorball/types';
import { combineLatest, Observable, of, switchMap, tap } from 'rxjs';

@Component({
  templateUrl: './association-host.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AssociationHostComponent implements OnInit {
  selectedAssociation$!: Observable<GameOperation | null>;
  association$!: Observable<GameOperation[]>;
  leagues$?: Observable<League[]>;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.selectedAssociation$ = this._associationService.selectedAssociation$;

    this.association$ = this._associationService.associations$;
    console.log(this._route);
    this._associationService.selectAssociation(this._route);

    this.leagues$ = combineLatest([
      this.selectedAssociation$,
      this._associationService.currentSeasonId$,
    ]).pipe(
      switchMap(([association, currentSeasonId]) => {
        if (!association || !currentSeasonId) {
          return of(null);
        }
        return this._leagueService.getLeagues(association.id, currentSeasonId);
      }),
      tap(console.log)
    );
  }
}
