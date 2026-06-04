import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  TeamGameDay,
  TeamGameDayConfirmResponse,
  TeamStats,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  constructor(private http: HttpClient) {}

  public getTeamStats(teamId: number) {
    const path = environment.apiURL + 'teams/' + teamId + '/stats.json';
    return this.http.get<TeamStats>(path);
  }

  // Spieltag-Bestätigung für Gastmannschaften (TM/VM-Self-Service)

  public getTeamGameDays() {
    return this.http.get<TeamGameDay[]>(
      environment.apiURL + 'user/team_game_days'
    );
  }

  public confirmTeamGameDay(
    gameDayId: number,
    teamId: number,
    body: {
      properly_conducted: boolean;
      answers?: { item_id: number; answer: boolean }[];
    } = { properly_conducted: true }
  ) {
    return this.http.post<TeamGameDayConfirmResponse>(
      environment.apiURL +
        'user/team_game_days/' +
        gameDayId +
        '/teams/' +
        teamId +
        '/confirm',
      body
    );
  }
}
