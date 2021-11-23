import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AssociationService, LeagueService } from '@floorball/core';
import { GameOperation, League } from '@floorball/types';
import { Observable, Subject, takeUntil, tap } from 'rxjs';

@Component({
  templateUrl: './association-host.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AssociationHostComponent implements OnInit, OnDestroy {
  selectedAssociation$!: Observable<GameOperation | null>;
  association$!: Observable<GameOperation[]>;
  leagues$?: Observable<League[] | null>;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute
  ) {}

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this.leagues$ = this._leagueService.leagues$;
    this.association$ = this._associationService.associations$;

    this._route.params
      .pipe(
        tap(() => {
          //this._leagueService.leagues$ = of([]);
          this._associationService.selectAssociation(this._route);
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }
}
