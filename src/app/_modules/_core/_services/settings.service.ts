import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface SeasonInfo {
  id: number;
  name: string;
  current: boolean;
}

export interface SeasonsResponse {
  current_season_id: number;
  seasons: SeasonInfo[];
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly base = `${environment.apiURL}admin/settings`;

  constructor(private http: HttpClient) {}

  getSeasons(): Observable<SeasonsResponse> {
    return this.http.get<SeasonsResponse>(`${this.base}/seasons.json`);
  }

  updateCurrentSeason(
    seasonId: number
  ): Observable<{ current_season_id: number }> {
    return this.http.patch<{ current_season_id: number }>(
      `${this.base}/current_season.json`,
      { season_id: seasonId }
    );
  }
}
