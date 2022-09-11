import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import {
  Game,
  GameEvent,
  GameEventInput,
  GameFields,
  GamePlayerEntry,
} from '@floorball/types';
import { environment } from 'src/environments/environment';
import { GameFlags } from '../../../_models/game-flags.interface';
import { GameAdditionalFields } from '../../../_models/game-additional-fields.interface';
import { RefereeEntry } from '../../../_models/referee-entry.interface';
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
    team: string,
    player_id: number,
    trikot_number: string,
    goalkeeper: boolean
  ) {
    const path =
      environment.apiURL +
      'user/games/' +
      gameId +
      '/lineup/' +
      team +
      '/add_player.json';
    return this.http.post<GamePlayerEntry[]>(path, {
      player_id,
      trikot_number,
      goalkeeper,
    });
  }

  public removeLineupPlayerToGame(
    gameId: number,
    team: string,
    trikot_number: string
  ) {
    const path =
      environment.apiURL +
      'user/games/' +
      gameId +
      '/lineup/' +
      team +
      '/remove_player.json';
    return this.http.post<GamePlayerEntry[]>(path, {
      trikot_number: parseInt(trikot_number, 10),
    });
  }

  public setLineupCaptain(gameId: number, team: string, trikot_number: string) {
    const path =
      environment.apiURL +
      'user/games/' +
      gameId +
      '/lineup/' +
      team +
      '/set_captain.json';
    return this.http.post<GamePlayerEntry[]>(path, {
      trikot_number: parseInt(trikot_number, 10),
    });
  }

  public addEvent(gameId: number, event: GameEventInput) {
    const path =
      environment.apiURL + 'user/games/' + gameId + '/events/add.json';
    return this.http.post<GameEvent[]>(path, event);
  }

  public setGameFlags(gameId: number, flags: GameFlags) {
    const path = environment.apiURL + 'user/games/' + gameId + '/set_flag.json';
    return this.http.post<Game>(path, flags);
  }

  public setGameField(gameId: number, fields: GameFields) {
    const path =
      environment.apiURL + 'user/games/' + gameId + '/set_field.json';
    return this.http.post<GamePlayerEntry[]>(path, fields);
  }

  public setReferee(
    gameId: number,
    refereeNumber: number,
    licenseNumber: number,
    name: string
  ) {
    const path =
      environment.apiURL +
      'user/games/' +
      gameId +
      '/referees/' +
      refereeNumber +
      '.json';
    return this.http.post<Game[]>(path, {
      license_id: licenseNumber,
      name: name,
    });
  }

  public getAdditionalFields(gameId: number) {
    const path =
      environment.apiURL + 'user/games/' + gameId + '/additional_fields.json';
    return this.http.get<GameAdditionalFields>(path);
  }

  public deleteEvent(gameId: number, eventId: number) {
    const path =
      environment.apiURL + 'user/games/' + gameId + '/events/remove.json';
    return this.http.post<GameEvent>(path, { event_id: eventId });
  }
}
