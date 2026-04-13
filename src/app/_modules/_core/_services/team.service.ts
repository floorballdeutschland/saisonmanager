import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TeamStats } from '@floorball/types';
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
}
