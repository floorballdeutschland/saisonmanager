import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';

import {
  AddLineupPlayerResponse,
  ChecklistVeto,
  ChecklistVetoAnswer,
  Game,
  GameAdditionalFields,
  GameDayReportFilter,
  GameDayReportOverview,
  GameEvent,
  GameEventInput,
  GameFields,
  GameFlags,
  GameInput,
  GamePlayerEntry,
  GameScan,
  NonEmptyArray,
  SecretaryGameDayStub,
  SecretaryHallDay,
  SecretaryTokenGameDay,
  StartingPlayerPosition,
  StartingPlayer,
  AwardDefinitions,
  AwardPlayer,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

interface SecretaryLicenseList {
  team_name: string;
  players: {
    name: string;
    birthdate?: string;
    license_status: string;
    approved_at?: string;
    valid_until?: string;
  }[];
}

interface SecretaryGameWire {
  id: number;
  game_number?: string;
  start_time?: string;
  home_team?: string;
  guest_team?: string;
  game_status?: string;
  game_day_id?: number;
  league?: string;
}

/** Rohform vom Server, inklusive der alten Antwort ohne `game_days`. */
interface SecretaryPayloadWire {
  game_day: SecretaryTokenGameDay;
  game_days?: SecretaryTokenGameDay[];
  games: SecretaryGameWire[];
  license_lists: Record<string, SecretaryLicenseList>;
  expires_at: string;
  created_by?: string;
}

/**
 * Begradigte Form für die Ansicht. Zwei Zusagen, auf die sie sich verlässt:
 * `game_days` ist nie leer, und jedes Spiel kennt seinen Spieltag – Letzteres
 * ist die Grundlage dafür, dass `matchReportUrl` die richtige Liga trifft.
 */
export interface SecretaryPayload {
  game_days: NonEmptyArray<SecretaryTokenGameDay>;
  games: (SecretaryGameWire & { game_day_id: number })[];
  license_lists: Record<string, SecretaryLicenseList>;
  expires_at: string;
  created_by?: string;
}

/**
 * Bringt die Antwort auf die Form, die `SecretaryPayload` zusagt. Hier liegt
 * auch die Verträglichkeit mit der alten API, die `game_days` noch nicht kennt.
 *
 * Eine unbrauchbare Antwort wird ausdrücklich abgewiesen statt weitergereicht:
 * Sonst schlüge weiter unten ein TypeError zu, den die Ansicht als „Link
 * abgelaufen" deutete. Das Sekretariat ließe sich dann einen neuen Link geben,
 * der genauso scheitert.
 */
export function normalizeSecretaryPayload(
  wire: SecretaryPayloadWire
): SecretaryPayload {
  const days = wire.game_days?.length
    ? wire.game_days
    : wire.game_day
      ? [wire.game_day]
      : [];

  if (!days.length || !Array.isArray(wire.games)) {
    console.error('Unerwartete Antwort für das Spielsekretariat', wire);
    throw new Error(
      'Die Antwort des Servers war unvollständig. Bitte lade die Seite neu.'
    );
  }

  return {
    ...wire,
    game_days: days as NonEmptyArray<SecretaryTokenGameDay>,
    // Nur der Altfall braucht den Rückfall, dort gibt es genau einen Spieltag.
    // Bei mehreren Spieltagen liefert die API game_day_id immer mit.
    games: wire.games.map((game) => ({
      ...game,
      game_day_id: game.game_day_id ?? days[0].id,
    })),
  };
}

export interface GameSchedulingConflict {
  id: number;
  game_number: string | null;
  start_time: string | null;
  home_team: string | null;
  guest_team: string | null;
  league_name: string;
}

@Injectable({
  providedIn: 'root',
})
export class GameService {
  constructor(private http: HttpClient) {}

  public getGame(gameId: number) {
    const path = environment.apiURL + 'games/' + gameId + '.json';
    return this.http.get<Game>(path);
  }

  // Prüft, ob ein (geplantes) Spiel zeitlich mit anderen Spielen in derselben
  // Halle am selben Tag kollidiert. Nicht-blockierend (nur Warnung).
  public getSchedulingConflicts(opts: {
    gameDayId: number;
    startTime: string;
    gameId?: number;
  }) {
    let params = new HttpParams()
      .set('game_day_id', String(opts.gameDayId))
      .set('start_time', opts.startTime);
    if (opts.gameId) {
      params = params.set('game_id', String(opts.gameId));
    }
    return this.http.get<{ conflicts: GameSchedulingConflict[] }>(
      environment.apiURL + 'games/scheduling_conflicts',
      { params }
    );
  }

  public createGame(game: GameInput) {
    const path = environment.apiURL + 'games.json';
    return this.http.post<{ success: boolean }>(path, game);
  }

  public updateGame(game: GameInput) {
    const path = environment.apiURL + 'games/' + (game.id ?? 0) + '.json';
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
    const path = environment.apiURL + 'games/' + (game.id ?? 0) + '.json';
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
    return this.http.post<AddLineupPlayerResponse>(path, {
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

  // Time-Outs sind keine Events, sondern die Spielfelder
  // home_timeout_string/guest_timeout_string. Game#extract_timeout_information
  // baut daraus Pseudo-Events mit den festen IDs 9001/9002, die events/remove
  // nie findet – gelöscht wird deshalb über das Spielfeld.
  public clearTimeout(gameId: number, team: 'home' | 'guest') {
    const field =
      team === 'home' ? 'home_timeout_string' : 'guest_timeout_string';
    return this.setGameField(gameId, { [field]: '' });
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

  public updateEvent(gameId: number, eventId: number, event: GameEventInput) {
    const path =
      environment.apiURL + 'user/games/' + gameId + '/events/update.json';
    return this.http.post<GameEvent[]>(path, { event_id: eventId, ...event });
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

  // SBK-Übersicht „Spieltage": alle Spielberichte im eigenen Spielbetriebs-Scope.
  public getGameDayReportOverview(filter?: GameDayReportFilter) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter ?? {})) {
      if (value) params = params.set(key, value);
    }
    return this.http.get<GameDayReportOverview>(
      environment.apiURL + 'admin/game_days/report_overview.json',
      { params }
    );
  }

  public getGameScan(gameId: number) {
    const path = environment.apiURL + 'user/games/' + gameId + '/scan.json';
    return this.http.get<GameScan | null>(path);
  }

  public uploadGameScan(gameId: number, file: File) {
    const path = environment.apiURL + 'user/games/' + gameId + '/scan.json';
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<GameScan>(path, formData);
  }

  public deleteGameScan(gameId: number) {
    const path = environment.apiURL + 'user/games/' + gameId + '/scan.json';
    return this.http.delete<{ success: boolean }>(path);
  }

  /**
   * Erzeugt den Link für einen Spieltag. Der Server nimmt dabei alle Spieltage
   * derselben Halle am selben Tag mit auf, für die man berechtigt ist –
   * `game_day_ids` nennt, welche das geworden sind.
   */
  public createSecretaryLink(gameDayId: number) {
    return this.http.post<{
      url: string;
      token: string;
      expires_at: string;
      created_by: string;
      game_day_id: number;
      game_day_ids: number[];
      game_days: SecretaryGameDayStub[];
    }>(
      environment.apiURL + 'user/game_days/' + gameDayId + '/secretary_link',
      {}
    );
  }

  public getSecretaryLink(gameDayId: number) {
    return this.http.get<{
      expires_at?: string;
      created_by?: string;
      game_day_ids?: number[];
      active?: boolean;
    }>(environment.apiURL + 'user/game_days/' + gameDayId + '/secretary_link');
  }

  /** Spieltage, für die man als VM/TM einen Link erzeugen darf, nach Halle und Tag. */
  public getSecretaryGameDays() {
    return this.http.get<SecretaryHallDay[]>(
      environment.apiURL + 'user/secretary_game_days'
    );
  }

  /**
   * Spieltagsdaten zum Sekretariats-Token.
   *
   * Die Antwort wird hier einmal begradigt: Eine ältere API kennt `game_days`
   * noch nicht und liefert nur den einen `game_day`, und `game_day_id` fehlt
   * dann an den Spielen. Frontend und API werden getrennt ausgerollt, also muss
   * beides gehen – aber nur an dieser Stelle. Die Ansicht bekommt eine Form, in
   * der die Spieltagsliste immer gefüllt und jedem Spiel sein Spieltag bekannt
   * ist.
   */
  public getSecretaryGameDay(token: string) {
    return this.http
      .get<SecretaryPayloadWire>(
        environment.apiURL +
          'public/secretary?token=' +
          encodeURIComponent(token)
      )
      .pipe(map((wire) => normalizeSecretaryPayload(wire)));
  }

  public setChecklistAnswers(
    gameId: number,
    answers: { item_id: number; question: string; answer: boolean }[]
  ) {
    return this.http.post<{ success: boolean }>(
      environment.apiURL + 'user/games/' + gameId + '/checklist_answers.json',
      { answers }
    );
  }

  // Einspruch des Ausrichtervereins gegen die Spieltagscheckliste. Der Token aus
  // der Bestätigungsmail ist die einzige Berechtigung, es gibt kein Konto dazu –
  // deshalb liegen beide Endpunkte unter `public/`-Semantik ohne Cookie-Session.
  public getChecklistVeto(gameId: number, token: string) {
    return this.http.get<ChecklistVeto>(
      environment.apiURL +
        'games/' +
        gameId +
        '/checklist_veto?token=' +
        encodeURIComponent(token)
    );
  }

  public submitChecklistVeto(
    gameId: number,
    token: string,
    answers: ChecklistVetoAnswer[]
  ) {
    return this.http.post<{ success: boolean }>(
      environment.apiURL + 'games/' + gameId + '/checklist_veto',
      { token, answers }
    );
  }

  public getRefereeReport(gameId: number) {
    return this.http.get<{
      uploaded: boolean;
      filename?: string;
      content_type?: string;
      uploaded_at?: string;
      url?: string;
    }>(environment.apiURL + 'games/' + gameId + '/referee_report');
  }

  public uploadRefereeReport(gameId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ success: boolean; filename: string }>(
      environment.apiURL + 'games/' + gameId + '/referee_report',
      formData
    );
  }
}
