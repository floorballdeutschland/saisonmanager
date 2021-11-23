import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import {
  GameScheduleEntry,
  League,
  ScorerEntry,
  TableEntry,
} from '@floorball/types';
import { ActivatedRoute } from '@angular/router';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { AssociationService } from '.';

@Injectable({
  providedIn: 'root',
})
export class LeagueService {
  selectedLeague$: Observable<League | null>;
  leagues$: Observable<League[] | null>;

  private _route$ = new BehaviorSubject<ActivatedRoute | null>(null);

  constructor(
    private http: HttpClient,
    private _associationService: AssociationService
  ) {
    this.selectedLeague$ = this._route$.pipe(
      switchMap((_route) => {
        console.log('aaa');
        if (!_route) {
          return of(null);
        }

        if (!_route.snapshot.params['leagueId']) {
          return of(null);
        }
        return this.getLeague(parseInt(_route.snapshot.params['leagueId']));
      })
    );

    this.leagues$ = combineLatest([
      this._associationService.selectedAssociation$,
      this._associationService.currentSeasonId$,
    ]).pipe(
      switchMap(([association, currentSeasonId]) => {
        if (!association || !currentSeasonId) {
          return of(null);
        }
        return this.getLeagues(association.id, currentSeasonId);
      }),
      shareReplay()
    );
  }

  public getLeagues(gameOperation: number, season: number) {
    const path =
      environment.apiURL +
      'game_operations/' +
      gameOperation +
      '/leagues/' +
      season +
      '.json';
    return this.http.get<League[]>(path);
  }

  public getLeague(leagueId: number) {
    return this.leagues$.pipe(
      map((_leagues) => _leagues?.find((_l) => _l.id === leagueId) ?? null)
    );
  }

  public getGameSchedule(league: number) {
    const path = environment.apiURL + 'leagues/' + league + '/schedule.json';
    return this.http.get<GameScheduleEntry[]>(path);
  }

  public getTable(league: number) {
    const path = environment.apiURL + 'leagues/' + league + '/table.json';
    return this.http.get<TableEntry[]>(path);
  }

  public getScorer(league: number) {
    const path = environment.apiURL + 'leagues/' + league + '/scorer.json';
    return this.http.get<ScorerEntry[]>(path);
  }

  selectLeague(route: ActivatedRoute) {
    this._route$.next(route);
  }

  clearLeague() {
    this._route$.next(null);
  }
}
