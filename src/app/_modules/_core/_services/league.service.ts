import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import {
  AdminLicenseEntry,
  Arena,
  Club,
  Gameday,
  GamedayInput,
  GamedayWithGames,
  GameOperationWithLeagues,
  GameScheduleEntry,
  League,
  LeagueQualification,
  LeagueWithTeams,
  Penalty,
  PenaltyCode,
  ScorerEntry,
  TableEntry,
  Team,
  TeamWithPlayers,
} from '@floorball/types';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import { AssociationService } from '.';
import { GroupedTable } from '../../../_models/table-entry.interface';

@Injectable({
  providedIn: 'root',
})
export class LeagueService {
  selectedLeague$: Observable<League | null>;
  leagues$: Observable<League[] | null>;

  private _route$ = new BehaviorSubject<ActivatedRoute | null>(null);

  constructor(
    private http: HttpClient,
    private _associationService: AssociationService,
    private _router: Router
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
      // Der Saison-Switcher folgt immer der gerade betrachteten Liga – egal ob
      // aktuelle oder vergangene Saison. So bleibt die Anzeige beim Navigieren
      // stabil auf der Saison der Liga und springt nicht auf die aktuelle
      // zurück. selectSeason ignoriert identische Werte (kein Reload-Loop).
      tap((_league) => {
        if (_league?.season_id) {
          this._associationService.selectSeason(Number(_league.season_id));
        }
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
    // Fallback für Ligen außerhalb der gewählten Saison (z. B. Deep-Links von
    // der Spielerseite): einzeln nachladen. Den Saison-Switcher stellt der
    // selectedLeague$-Stream anhand der geladenen Liga nach.
    const singleLeague$ = this.getSingleLeague(leagueId).pipe(
      catchError(() => of(null)),
      shareReplay(1)
    );

    return this.leagues$.pipe(
      switchMap((_leagues) => {
        if (!_leagues) {
          return of(null);
        }
        const league = _leagues.find((_l) => _l.id === leagueId);
        return league ? of(league) : singleLeague$;
      })
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

  public getGroupedTable(league: number) {
    const path =
      environment.apiURL + 'leagues/' + league + '/grouped_table.json';
    return this.http.get<GroupedTable>(path);
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

  // Nutzer-initiierter Saisonwechsel über den Saison-Switcher. Bei geöffneter
  // Liga-Seite muss erst zur Verbands-Übersicht navigiert werden: die Liga
  // existiert in der anderen Saison nicht unter derselben ID, und solange sie
  // geöffnet bleibt, setzt der selectedLeague$-Tap die Saisonwahl sofort
  // wieder auf die Liga-Saison zurück (Nutzerwahl hätte nie Wirkung).
  changeSeason(seasonId: number) {
    const leagueRoute = this._route$.getValue();
    if (!leagueRoute) {
      this._associationService.selectSeason(seasonId);
      return;
    }

    const association = leagueRoute.snapshot.parent?.params['association'];
    void this._router
      .navigate(association ? ['/', association] : ['/'])
      .then(() => this._associationService.selectSeason(seasonId));
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

  public adminDestroyGameDay(gamedayId: number) {
    const path = environment.apiURL + 'game_days/' + gamedayId + '.json';
    return this.http.delete<{ success: boolean }>(path, {});
  }

  public adminCreateLeagues(league: League) {
    const path = environment.apiURL + 'admin/leagues.json';
    return this.http.post<League>(path, league);
  }

  public adminUpdateLeague(id: number, data: Partial<League>) {
    const path = environment.apiURL + 'admin/leagues/' + id + '.json';
    return this.http.patch<League>(path, { league: data });
  }

  public adminCopyLeague(sourceLeagueId: number, teamIds: number[]) {
    const path =
      environment.apiURL + 'admin/leagues/' + sourceLeagueId + '/copy.json';
    return this.http.post<League>(path, { team_ids: teamIds });
  }

  public copyPreroundLicenses(leagueId: number) {
    const path =
      environment.apiURL +
      'admin/leagues/' +
      leagueId +
      '/copy_preround_licenses.json';
    return this.http.post<{ copied: number }>(path, {});
  }

  public createQualification(
    leagueId: number,
    data: Omit<LeagueQualification, 'id' | 'target_league_name'>
  ) {
    const path = `${environment.apiURL}admin/leagues/${leagueId}/qualifications.json`;
    return this.http.post<LeagueQualification>(path, {
      league_qualification: data,
    });
  }

  public updateQualification(
    leagueId: number,
    qualId: number,
    data: Partial<Omit<LeagueQualification, 'id' | 'target_league_name'>>
  ) {
    const path = `${environment.apiURL}admin/leagues/${leagueId}/qualifications/${qualId}.json`;
    return this.http.patch<LeagueQualification>(path, {
      league_qualification: data,
    });
  }

  public deleteQualification(leagueId: number, qualId: number) {
    const path = `${environment.apiURL}admin/leagues/${leagueId}/qualifications/${qualId}.json`;
    return this.http.delete<void>(path);
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
    return this.http.get<{
      arenas: Arena[];
      teams: Team[];
      clubs: Club[];
      referee_assignment_enabled: boolean;
    }>(path);
  }

  public adminImportGameSchedule(data: FormData) {
    const path = environment.apiURL + 'admin/leagues/import_schedule.json';
    return this.http.post<{ errors: [string]; warnings: [string] }>(path, data);
  }

  public adminImportTeams(
    leagueId: number,
    sourceLeagueId: number,
    topN: number
  ) {
    const path =
      environment.apiURL + 'admin/leagues/' + leagueId + '/import_teams.json';
    return this.http.post<{
      imported: number;
      skipped: number;
      failed: number;
    }>(path, { source_league_id: sourceLeagueId, top_n: topN });
  }

  public adminCreateTeam(team: Team) {
    const path = environment.apiURL + 'admin/teams.json';
    return this.http.post<Team>(path, team);
  }

  public adminGetTeam(teamId: number) {
    const path = environment.apiURL + 'admin/teams/' + teamId + '.json';
    return this.http.get<Team>(path);
  }

  public adminDeleteTeam(teamId: number) {
    const path = environment.apiURL + 'admin/teams/' + teamId + '.json';
    return this.http.delete<void>(path);
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

  public getAdminLicenses(
    seasonId?: string,
    gameOperationId?: number
  ): Observable<AdminLicenseEntry[]> {
    const params: Record<string, string> = {};
    if (seasonId) params['season_id'] = seasonId;
    if (gameOperationId) params['game_operation_id'] = String(gameOperationId);
    return this.http.get<AdminLicenseEntry[]>(
      environment.apiURL + 'admin/licenses.json',
      { params }
    );
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

  public adminUploadBanner(leagueId: number, file: File) {
    const formData = new FormData();
    formData.append('banner', file);
    return this.http.post<{ banner_url: string }>(
      `${environment.apiURL}admin/leagues/${leagueId}/upload_banner.json`,
      formData
    );
  }

  public adminDeleteBanner(leagueId: number) {
    return this.http.delete(
      `${environment.apiURL}admin/leagues/${leagueId}/banner.json`
    );
  }
}
