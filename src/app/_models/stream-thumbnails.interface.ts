/**
 * Endstand für das Highlight-Bild. Kommt nur nach dem Schlusspfiff, vorher
 * steht `null` (Rails lässt keinen Schlüssel weg).
 */
export interface StreamThumbnailResult {
  home_goals: number;
  guest_goals: number;
  postfix?: { short?: string | null; long?: string | null } | null;
}

/**
 * Ein Spiel, wie es der Overlay-Abruf `public/overlay/game_day` liefert.
 *
 * Die Namen heißen hier `home_team`/`guest_team` und nicht `*_team_name`: Das
 * Bedienfeld liest sie seit jeher so. Wappen und Endstand sind seit
 * feedback#77 dabei und fehlen bei einer älteren API, deshalb optional.
 */
export interface OverlayGameDayGame {
  id: number;
  game_number: string | null;
  start_time: string | null;
  home_team: string | null;
  guest_team: string | null;
  started: boolean | null;
  ended: boolean | null;
  game_status: string | null;
  home_team_logo?: string | null;
  guest_team_logo?: string | null;
  result?: StreamThumbnailResult | null;
}

export interface OverlayGameDayPayload {
  game_day: {
    id: number;
    date: string;
    number: number | null;
    league: string | null;
    league_id: number | null;
    arena: string | null;
  };
  games: OverlayGameDayGame[];
  valid_from?: string | null;
  expires_at: string;
}

/** Ein Spiel im Saisonabruf `user/secretary_game_days/season`. */
export interface SeasonThumbnailGame {
  id: number;
  game_number: string | null;
  start_time: string;
  home_team_name: string;
  guest_team_name: string;
  home_team_logo: string | null;
  guest_team_logo: string | null;
  ended: boolean | null;
  result: StreamThumbnailResult | null;
}

export interface SeasonThumbnailGameDay {
  id: number;
  number: number;
  date: string;
  league_id: number;
  league: string | null;
  arena: { name: string | null };
  games: SeasonThumbnailGame[];
}

export interface SeasonThumbnailPayload {
  season_id: number;
  /** Saisons, in denen der Verein ausgerichtet hat, neueste zuerst. */
  seasons: { id: number; name: string }[];
  game_days: SeasonThumbnailGameDay[];
}
