import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GameOperation, InitData, Season } from '@floorball/types';
import {
  BehaviorSubject,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AssociationService {
  associationsIsLoading$ = new BehaviorSubject(false);
  associations$: Observable<GameOperation[]>;
  selectedAssociation$: Observable<GameOperation | null>;

  currentSeasonId$: Observable<number>;
  seasons$: Observable<Season[]>;

  private _route$ = new BehaviorSubject<ActivatedRoute | null>(null);

  constructor(private http: HttpClient) {
    this.associationsIsLoading$.next(true);

    const initData$ = this.getInit().pipe(shareReplay());

    this.associations$ = initData$.pipe(
      map((_result) => _result.game_operations)
    );

    this.seasons$ = initData$.pipe(map((_result) => _result.seasons));

    this.currentSeasonId$ = initData$.pipe(
      map((_result) => _result.current_season_id)
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

  public getInit() {
    const path = environment.apiURL + 'init.json';
    return this.http.get<InitData>(path);
  }
}
