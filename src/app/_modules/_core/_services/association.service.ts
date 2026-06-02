import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  GameOperation,
  InitData,
  Season,
  StateAssociation,
} from '@floorball/types';
import {
  BehaviorSubject,
  combineLatest,
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
  selectedStateAssociation$: Observable<StateAssociation | null>;
  stateAssociations$: Observable<StateAssociation[]>;

  currentSeasonId$: Observable<number>;
  selectedSeason$: Observable<Season | null>;
  seasons$: Observable<Season[]>;

  displayAssociationHeader$ = new BehaviorSubject(true);

  private _route$ = new BehaviorSubject<ActivatedRoute | null>(null);
  private _selectedSeasonId$ = new BehaviorSubject<number | null>(null);

  constructor(private http: HttpClient) {
    this.associationsIsLoading$.next(true);

    const initData$ = this.getInit().pipe(shareReplay());

    this.associations$ = initData$.pipe(
      map((_result) => _result.game_operations)
    );

    this.seasons$ = initData$.pipe(map((_result) => _result.seasons));

    this.stateAssociations$ = initData$.pipe(
      map((_result) => _result.state_associations ?? [])
    );

    // Seed the BehaviorSubject with the current season from init
    initData$
      .pipe(tap((d) => this._selectedSeasonId$.next(d.current_season_id)))
      .subscribe();

    this.currentSeasonId$ = this._selectedSeasonId$.pipe(
      switchMap((id) => (id !== null ? of(id) : of(0)))
    );

    this.selectedSeason$ = combineLatest([
      this.seasons$,
      this._selectedSeasonId$,
    ]).pipe(
      map(([seasons, selectedId]) => {
        if (!seasons) return null;
        return seasons.find((_s) => _s.id === selectedId) ?? null;
      })
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

    this.selectedStateAssociation$ = combineLatest([
      this.selectedAssociation$,
      this.stateAssociations$,
    ]).pipe(
      map(([go, sas]) => {
        if (!go?.state_association_id) return null;
        return sas.find((sa) => sa.id === go.state_association_id) ?? null;
      })
    );
  }

  selectAssociation(route: ActivatedRoute) {
    this._route$.next(route);
  }

  clearAssociation() {
    this._route$.next(null);
  }

  selectSeason(seasonId: number) {
    this._selectedSeasonId$.next(seasonId);
  }

  public getInit() {
    const path = environment.apiURL + 'init.json';
    return this.http.get<InitData>(path);
  }
}
