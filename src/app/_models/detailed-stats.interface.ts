/**
 * Ausführliche Statistik eines im Tabletmodus erfassten Spiels
 * (`GET games/:id/detailed_stats.json`, fe#344 / api#816).
 *
 * Die Koordinaten der Schüsse sind auf die Angriffsrichtung des schießenden
 * Teams normiert, über das ganze Feld von Bande zu Bande (40 × 20 m): x = 0
 * eigene Bande hinter dem eigenen Tor, x = 1 gegnerische Bande, y = 0 links
 * und y = 1 rechts aus Sicht des Angreifers. Die Seitenwechsel je Abschnitt
 * sind damit bereits herausgerechnet.
 */
export type ShotTeam = 'home' | 'guest';

export type ShotResult = 'goal' | 'saved' | 'missed' | 'blocked';

/** Person in öffentlicher Anzeigeform (inklusive DSGVO-Anonymisierung). */
export interface PersonRef {
  trikot_number: number | null;
  name: string;
}

export interface DetailedStatsShot {
  team: ShotTeam;
  period: number;
  game_time: string;
  x: number;
  y: number;
  result: ShotResult;
  shooter: PersonRef | null;
}

/** `on_goal` = Tore + gehaltene Schüsse. */
export interface TeamShotStats {
  shots: number;
  on_goal: number;
  goals: number;
  blocked: number;
  missed: number;
}

export interface TeamDetailedStats extends TeamShotStats {
  /** Schlüssel ist die Abschnittsnummer als Zeichenkette. */
  by_period: Record<string, TeamShotStats>;
}

export interface GoalkeeperStats {
  team: ShotTeam;
  trikot_number: number | null;
  name: string;
  saves: number;
  shots_against: number;
  save_pct: number | null;
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
  shots: DetailedStatsShot[];
  teams: Record<ShotTeam, TeamDetailedStats>;
  goalkeepers: GoalkeeperStats[];
  players: PlayerShotStats[];
}
