import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Club, Player, Nation } from '@floorball/types';
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
    const path = environment.apiURL + 'admin/players/' + playerId + '.json';
    return this.http.get<Player>(path);
  }

  public getNations() {
    const path = environment.apiURL + 'user/players/nations.json';
    return this.http.get<Nation[]>(path);
  }

  public adminCreateOrUpdatePlayer(player: Player) {
    const path = environment.apiURL + 'admin/players.json';
    return this.http.post<Player>(path, player);
  }
}
