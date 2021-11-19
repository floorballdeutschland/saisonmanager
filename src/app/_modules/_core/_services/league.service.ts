import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { GameScheduleEntry, ScorerEntry, TableEntry } from '@floorball/types';

@Injectable({
  providedIn: 'root',
})
export class LeagueService {
  constructor(private http: HttpClient) {}

  // public getLeagues(gameOperation: number, season: number) {
  //   const path = environment.apiURL + 'init.json'
  //   return this.http.get<InitData[]>(path)
  // }

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
}
