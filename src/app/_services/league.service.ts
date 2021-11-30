import { Injectable } from '@angular/core'
import { HttpClient , HttpParams} from '@angular/common/http'

import { environment } from '../../environments/environment'
import { GameScheduleEntry, InitData, League, ScorerEntry, TableEntry } from '../_models'

@Injectable()
export class LeagueService {

  constructor(
      private http: HttpClient,
    ) {
  }

  public getLeagues(gameOperation: number, season: number) {
    const path = environment.apiURL + 'game_operations/' + gameOperation + '/leagues/' + season + '.json'
    return this.http.get<League[]>(path)
  }

  public getLeague(league: number) {
    const path = environment.apiURL + 'leagues/' + league + '.json'
    return this.http.get<League>(path)
  }

  public getGameSchedule(league: number) {
    const path = environment.apiURL + 'leagues/' + league + '/schedule.json'
    return this.http.get<GameScheduleEntry[]>(path)
  }

  public getGameScheduleForGameDay(league: number, game_day_number: number) {
    const path = environment.apiURL + 'leagues/' + league + '/game_days/' + game_day_number +'/schedule.json'
    return this.http.get<GameScheduleEntry[]>(path)
  }

  public getGameScheduleForCurrentGameDay(league: number) {
    const path = environment.apiURL + 'leagues/' + league + '/game_days/current/schedule.json'
    return this.http.get<GameScheduleEntry[]>(path)
  }

  public getTable(league: number) {
    const path = environment.apiURL + 'leagues/' + league + '/table.json'
    return this.http.get<TableEntry[]>(path)
  }

  public getScorer(league: number) {
    const path = environment.apiURL + 'leagues/' + league + '/scorer.json'
    return this.http.get<ScorerEntry[]>(path)
  }
}
