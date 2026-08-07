/**
 * Ein Spieltag, wie ihn die Sekretariats-Übersicht ausweist.
 */
export interface SecretaryGameDayStub {
  id: number;
  number?: number;
  date: string;
  league?: string;
  league_id?: number;
  games_count: number;
}

export interface SecretaryLinkInfo {
  expires_at: string;
  created_by?: string;
  game_day_ids: number[];
}

/**
 * Alle Spieltage, die am selben Tag in derselben Halle laufen. Das Sekretariat
 * sitzt pro Halle am Tisch, nicht pro Liga – ein Link deckt deshalb die ganze
 * Gruppe ab.
 *
 * `other_game_days_in_hall` sind die Spieltage derselben Halle, für die der
 * angemeldeten Person die Berechtigung fehlt. Sie stecken nicht im Link und
 * werden nur genannt, damit erkennbar bleibt, warum ein Spiel fehlt.
 */
export interface SecretaryHallDay {
  arena_id: number | null;
  arena?: string;
  arena_city?: string;
  date: string;
  game_days: SecretaryGameDayStub[];
  other_game_days_in_hall: SecretaryGameDayStub[];
  link: SecretaryLinkInfo | null;
}
