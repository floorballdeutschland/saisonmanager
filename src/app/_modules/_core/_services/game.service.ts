import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Game } from '@floorball/types';
import { environment } from 'src/environments/environment';
@Injectable({
  providedIn: 'root',
})
export class GameService {
  constructor(private http: HttpClient) {}

  public getGame(gameId: number) {
    const path = environment.apiURL + 'games/' + gameId + '.json';
    return this.http.get<Game>(path);
  }

  public addLineupPlayerToGame(
    gameId: number,
    team: 'home' | 'guest',
    player_id: number,
    trikot_number: number,
    goalkeeper: boolean
  ) {
    const path =
      environment.apiURL +
      'user/games/' +
      gameId +
      '/lineup_player/' +
      team +
      '.json';
    return this.http.post<Game>(path, { player_id, trikot_number, goalkeeper });
  }
}
