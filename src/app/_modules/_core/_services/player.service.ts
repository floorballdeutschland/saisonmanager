import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Club, Player } from '@floorball/types';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  constructor(private http: HttpClient) {}

  public getClubPlayers(clubId: number) {
    const path = environment.apiURL + 'admin/clubs/' + clubId + '/players.json';
    return this.http.get<Club>(path);
  }

  public getPlayer(playerId: number) {
    const path = environment.apiURL + 'admin/player/' + playerId + '.json';
    return this.http.get<Player>(path);
  }
}
