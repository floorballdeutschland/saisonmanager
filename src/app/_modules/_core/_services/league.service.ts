import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import {
  Arena,
  Club,
  Gameday,
  GamedayInput,
  GamedayWithGames,
  GameOperationWithLeagues,
  GameScheduleEntry,
  League,
  LeagueClass,
  LeagueWithTeams,
  Penalty,
  PenaltyCode,
  ScorerEntry,
  TableEntry,
  Team,
  TeamWithPlayers,
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
        if (!_route) {
          return of(null);
        }

        if (!_route.snapshot.params['leagueId']) {
          return of(null);
        }
        return this.getLeague(parseInt(_route.snapshot.params['leagueId']));
      }),
      shareReplay()
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
    //return this.getSingleLeague(leagueId);
    return this.leagues$.pipe(
      map((_leagues) => _leagues?.find((_l) => _l.id === leagueId) ?? null)
    );
  }

  public getSingleLeague(league: number) {
    const path = environment.apiURL + 'leagues/' + league + '.json';
    return this.http.get<League>(path);
  }

  public getGameSchedule(league: number) {
    const path = environment.apiURL + 'leagues/' + league + '/schedule.json';
    return this.http.get<GameScheduleEntry[]>(path);
  }

  public getGameScheduleForGameDay(league: number, game_day_number: number) {
    const path =
      environment.apiURL +
      'leagues/' +
      league +
      '/game_days/' +
      game_day_number +
      '/schedule.json';
    return this.http.get<GameScheduleEntry[]>(path);
  }

  public getGameScheduleForCurrentGameDay(league: number) {
    const path =
      environment.apiURL +
      'leagues/' +
      league +
      '/game_days/current/schedule.json';
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

  //
  // admin routes
  //
  public getAdminLeagues() {
    const path = environment.apiURL + 'admin/leagues.json';
    return this.http.get<GameOperationWithLeagues[]>(path);
  }

  public getAdminGameDay(gameDayId: number) {
    const path = environment.apiURL + 'game_days/' + gameDayId + '.json';
    return this.http.get<Gameday>(path);
  }

  public adminCreateGameDay(gameday: GamedayInput) {
    const path = environment.apiURL + 'game_days.json';
    return this.http.post<{ success: boolean }>(path, gameday);
  }

  public adminUpdateGameDay(gameday: GamedayInput) {
    const path = environment.apiURL + 'game_days/' + gameday.id || 0 + '.json';
    return this.http.put<{ success: boolean }>(path, gameday);
  }

  public adminCreateLeagues(league: League) {
    const path = environment.apiURL + 'admin/leagues.json';
    return this.http.post<League>(path, league);
  }

  public getAdminLeagueClasses() {
    const path = environment.apiURL + 'admin/league_classes.json';
    return this.http.get<LeagueClass[]>(path);
  }

  public getLeagueWithTeams(league: number) {
    const path = environment.apiURL + 'admin/leagues/' + league + '/teams.json';
    return this.http.get<LeagueWithTeams>(path);
  }

  public getAdminGameSchedule(id: number) {
    const path =
      environment.apiURL + 'admin/leagues/' + id + '/game_schedule.json';
    return this.http.get<GamedayWithGames[]>(path);
  }

  public getAdminLeagueAdditionalReferences(id: number) {
    const path =
      environment.apiURL +
      'admin/leagues/' +
      id +
      '/additional_references.json';
    return this.http.get<{ arenas: Arena[]; teams: Team[]; clubs: Club[] }>(
      path
    );
  }

  public adminImportGameSchedule(data: FormData) {
    const path = environment.apiURL + 'admin/leagues/import_schedule.json';
    return this.http.post<{ errors: [string]; warnings: [string] }>(path, data);
  }

  public adminCreateTeam(team: Team) {
    const path = environment.apiURL + 'admin/teams.json';
    return this.http.post<Team>(path, team);
  }

  public adminGetTeam(teamId: number) {
    const path = environment.apiURL + 'admin/teams/' + teamId + '.json';
    return this.http.get<Team>(path);
  }

  public getLeagueClubs(id: number, type: string) {
    const path =
      environment.apiURL + 'admin/league/clubs/' + type + '/' + id + '.json';
    return this.http.get<Club[]>(path);
  }

  public getAdminLeagueLicenses(leagueId: number) {
    const path =
      environment.apiURL + '/admin/leagues/' + leagueId + '/licenses.json';
    return this.http.get<TeamWithPlayers[]>(path);
  }

  public getUserLeagueLicenses(leagueId: number) {
    const path =
      environment.apiURL + '/user/leagues/' + leagueId + '/licenses.json';
    return this.http.get<TeamWithPlayers[]>(path);
  }

  public getUserLeaguesLicenseIndex() {
    const path = environment.apiURL + 'user/leagues/licenses/index.json';
    return this.http.get<GameOperationWithLeagues[]>(path);
  }

  public getPenalties() {
    const path = environment.apiURL + 'user/leagues/penalties.json';
    return this.http.get<Penalty[]>(path);
  }

  public getPenaltyCodes() {
    const path = environment.apiURL + 'user/leagues/penalty_codes.json';
    return this.http.get<PenaltyCode[]>(path);
  }
}
