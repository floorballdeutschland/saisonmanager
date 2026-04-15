import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import {
  Game,
  GameAdditionalFields,
  GameEvent,
  GameEventInput,
  GameFields,
  GameFlags,
  GameInput,
  GamePlayerEntry,
  StartingPlayerPosition,
  StartingPlayer,
  AwardDefinitions,
  AwardPlayer,
} from '@floorball/types';
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

  public createGame(game: GameInput) {
    const path = environment.apiURL + 'games.json';
    return this.http.post<{ success: boolean }>(path, game);
  }

  public updateGame(game: GameInput) {
    const path = environment.apiURL + 'games/' + game.id || '0' + '.json';
    return this.http.put<{ success: boolean }>(path, {
      ...game,
      notice_type: game.notice_type !== 'null' ? game.notice_type : null,
      notice_string: game.notice_string !== 'null' ? game.notice_string : null,
    });
  }

  public updateGameRating(gameId: number, ratingMode: number) {
    const path = environment.apiURL + 'games/' + gameId + '.json';
    return this.http.put<{ success: boolean }>(path, { forfait: ratingMode });
  }

  public deleteGame(game: GameInput) {
    const path = environment.apiURL + 'games/' + game.id || '0' + '.json';
    return this.http.delete<{ success: boolean }>(path);
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

  public setStartingPlayer(
    gameId: number,
    team: string,
    player_id: number,
    position: StartingPlayerPosition
  ) {
    const path =
      environment.apiURL +
      'user/games/' +
      gameId +
      '/starting/' +
      team +
      '/' +
      position +
      '/set_player.json';
    return this.http.post<{
      home: StartingPlayer[];
      guest: StartingPlayer[];
    }>(path, { player_id });
  }

  public setPlayerAward(
    gameId: number,
    team: string,
    player_id: number,
    award: AwardDefinitions
  ) {
    const path =
      environment.apiURL +
      'user/games/' +
      gameId +
      '/award/' +
      team +
      '/' +
      award +
      '/set_player.json';
    return this.http.post<{
      home: AwardPlayer[];
      guest: AwardPlayer[];
    }>(path, { player_id });
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
    lastname: string,
    firstname: string
  ) {
    const path =
      environment.apiURL +
      'user/games/' +
      gameId +
      '/referees/' +
      refereeNumber +
      '.json';
    return this.http.post<Game>(path, {
      license_id: licenseNumber || '',
      firstname: firstname,
      lastname: lastname,
    });
  }

  public setCoach(
    gameId: number,
    side: string,
    coachNumber: number,
    firstname: string,
    lastname: string
  ) {
    const path =
      environment.apiURL +
      'user/games/' +
      gameId +
      '/lineup/' +
      side +
      '/add_coach/' +
      coachNumber +
      '.json';
    return this.http.post<Game>(path, {
      first_name: firstname,
      last_name: lastname,
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

  public setGameStatus(gameId: number, game_status: string) {
    const path =
      environment.apiURL + 'user/games/' + gameId + '/game_status.json';
    return this.http.post<Game>(path, { game_status });
  }

  public setInGameStatus(gameId: number, ingame_status: string) {
    const path =
      environment.apiURL + 'user/games/' + gameId + '/game_status.json';
    return this.http.post<Game>(path, { ingame_status });
  }

  public reopenGame(gameId: number) {
    const path = environment.apiURL + 'user/games/' + gameId + '/reopen.json';
    return this.http.post<{ success: boolean }>(path, {});
  }
}
