import { Injectable } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Params, Router } from '@angular/router';
import {
  BehaviorSubject,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs';
import { Association, GameOperation } from 'src/app/_models';
import { MetaService } from 'src/app/_services';

const allAssociations: Association[] = [
  {
    title: 'Floorball Deutschland',
    logo: '/asset/association/ger.png',
    slug: 'floorball-deutschland',
  },
];

@Injectable({
  providedIn: 'root',
})
export class AssociationService {
  associationsIsLoading$ = new BehaviorSubject(false);
  associations$: Observable<GameOperation[]>;

  selectedAssociation$?: Observable<GameOperation | null>;
  private _route$ = new BehaviorSubject<ActivatedRoute | null>(null);

  constructor(
    private _route: ActivatedRoute,
    private _router: Router,
    private _metaService: MetaService
  ) {
    this.associationsIsLoading$.next(true);

    this.associations$ = this._metaService.getInit().pipe(
      map((_result) => _result.game_operations),
      shareReplay()
    );

    this.associations$
      .pipe(tap(() => this.associationsIsLoading$.next(false)))
      .subscribe();

    this.selectedAssociation$ = this._route$.pipe(
      switchMap((_route) => {
        if (!this.associations$ || !_route) {
          return of(null);
        }

        return this.associations$.pipe(
          map(
            (_associations) =>
              _associations.find(
                (_association) =>
                  _association.path === _route.snapshot.params['association']
              ) ?? null
          )
        );
      })
    );
  }

  selectAssociation(route: ActivatedRoute) {
    this._route$.next(route);
  }

  clearAssociation() {
    this._route$.next(null);
  }
}
