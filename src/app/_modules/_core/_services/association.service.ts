import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  BehaviorSubject,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import { GameOperation } from 'src/app/_models';
import { MetaService } from 'src/app/_services';

@Injectable({
  providedIn: 'root',
})
export class AssociationService {
  associationsIsLoading$ = new BehaviorSubject(false);
  associations$: Observable<GameOperation[]>;

  selectedAssociation$?: Observable<GameOperation | null>;
  private _route$ = new BehaviorSubject<ActivatedRoute | null>(null);

  constructor(private _metaService: MetaService) {
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
