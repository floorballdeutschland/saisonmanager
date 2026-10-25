import { ShotResult, ShotTeam } from './game-shot.interface';

/**
 * Ausführliche Statistik eines im Tabletmodus erfassten Spiels
 * (`GET games/:id/detailed_stats.json`, fe#344 / api#816).
 *
 * Die Koordinaten der Schüsse sind auf die Angriffsrichtung des schießenden
 * Teams normiert, über das ganze Feld von Bande zu Bande (Großfeld 40 × 20 m,
 * Kleinfeld 28 × 16 m, je nach `league.field_size`): x = 0
 * eigene Bande hinter dem eigenen Tor, x = 1 gegnerische Bande, y = 0 links
 * und y = 1 rechts aus Sicht des Angreifers. Die Seitenwechsel je Abschnitt
 * sind damit bereits herausgerechnet.
 */

/** Person in öffentlicher Anzeigeform (inklusive DSGVO-Anonymisierung). */
export interface PersonRef {
  trikot_number: number | null;
  name: string;
}

/**
 * Spielstärke eines Schusses ohne eigenen Torhüter (fe#610), Feldspieler des
 * schießenden Teams gegen die des Gegners. Die API leitet sie aus den beim
 * Schuss laufenden Strafen ab; Strafen beider Teams heben sich auf.
 */
export type ExtraAttackerStrength = '6v5' | '6v4' | '6v3' | '5v5' | '4v5';

export interface DetailedStatsShot {
  team: ShotTeam;
  period: number;
  game_time: string;
  /**
   * `null` bei einer Parade ohne Feldposition (Schnellzähler, Feedback #62):
   * zählt in Summen und beim Torhüter, aber in keiner Schussgrafik.
   */
  x: number | null;
  y: number | null;
  result: ShotResult;
  shooter: PersonRef | null;
  /** Verknüpftes offizielles Tor (id in games.events), `null` ohne Verknüpfung. */
  event_id: number | null;
  /** Schuss aus einem Freischlag heraus (fe#589). */
  from_free_hit?: boolean;
  /** Seit Feedback #61, #63, #64; ältere API-Stände liefern die Felder nicht. */
  from_penalty_shot?: boolean;
  empty_net?: boolean;
  /**
   * Das schießende Team spielt ohne eigenen Torhüter. Das ist nicht immer 6
   * gegen 5, siehe `extra_attacker_strength`.
   */
  extra_attacker?: boolean;
  /**
   * Seit fe#610, nur bei `extra_attacker`. `null` ohne Kennung oder wenn der
   * Schuss keine Spielzeit hat; ältere API-Stände liefern das Feld nicht.
   */
  extra_attacker_strength?: ExtraAttackerStrength | null;
}

/**
 * Freischlag (fe#589, api#837), normiert auf die Angriffsrichtung des
 * ausführenden Teams wie die Schüsse. Nur Statistik, keine Szenen.
 */
export interface DetailedStatsFreeHit {
  team: ShotTeam;
  period: number;
  game_time: string;
  x: number;
  y: number;
}

/** `on_goal` = Tore + gehaltene Schüsse. */
export interface TeamShotStats {
  shots: number;
  on_goal: number;
  goals: number;
  blocked: number;
  missed: number;
  /** Ab api#837; ältere Antworten haben die Felder nicht. */
  free_hits?: number;
  shots_from_free_hit?: number;
  goals_from_free_hit?: number;
  /** Seit Feedback #61, #63, #64; ältere API-Stände liefern sie nicht. */
  penalty_shots?: number;
  goals_from_penalty_shot?: number;
  goals_empty_net?: number;
  /** Alle Tore ohne eigenen Torhüter, Summe der fünf Felder darunter. */
  goals_extra_attacker?: number;
  /**
   * Aufteilung nach Spielstärke (fe#610), ältere API-Stände ohne:
   * `shorthanded` = das schießende Team war selbst in Unterzahl,
   * `unknown` = der Schuss hat keine Spielzeit.
   */
  goals_extra_attacker_6v5?: number;
  goals_extra_attacker_6v4?: number;
  goals_extra_attacker_6v3?: number;
  goals_extra_attacker_shorthanded?: number;
  goals_extra_attacker_unknown?: number;
}

export interface TeamDetailedStats extends TeamShotStats {
  /** Schlüssel ist die Abschnittsnummer als Zeichenkette. */
  by_period: Record<string, TeamShotStats>;
}

export interface GoalkeeperSaveStats {
  saves: number;
  shots_against: number;
  save_pct: number | null;
}

export interface GoalkeeperStats extends GoalkeeperSaveStats {
  team: ShotTeam;
  trikot_number: number | null;
  name: string;
  /** Je Abschnitt (Schlüssel als Zeichenkette), seit Feedback #62, ältere API-Stände ohne. */
  by_period?: Record<string, GoalkeeperSaveStats>;
}

export interface PlayerShotStats {
  team: ShotTeam;
  trikot_number: number | null;
  name: string;
  shots: number;
  on_goal: number;
  goals: number;
}

export interface DetailedStats {
  /** `true` nur, wenn das Sekretariat die Schüsse als vollständig bestätigt hat. */
  complete: boolean | null;
  /** Nur Schüsse, Freischläge stehen in `free_hits`. */
  shots: DetailedStatsShot[];
  free_hits?: DetailedStatsFreeHit[];
  teams: Record<ShotTeam, TeamDetailedStats>;
  goalkeepers: GoalkeeperStats[];
  players: PlayerShotStats[];
}
