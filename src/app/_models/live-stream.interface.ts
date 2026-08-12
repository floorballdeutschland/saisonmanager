/**
 * Ein Spiel des Tages mit hinterlegtem Livestream oder Aufzeichnung.
 *
 * `result` und `result_string` fehlen bei noch nicht angepfiffenen Spielen und
 * werden bei laufenden Partien zurückgehalten, wenn der Zugang keine
 * Echtzeit-Freigabe hat. Für die Anzeige auf der eigenen Website ändert das
 * nichts, der Frontend-Schlüssel hat sie.
 */
export interface LiveStreamGame {
  game_id: number;
  game_number: string | null;
  date: string | null;
  time: string | null;
  status: 'running' | 'upcoming' | 'ended';
  started: boolean;
  ended: boolean;
  current_period_title?: { title?: string } | null;
  league: { id: number; name: string; short_name: string } | null;
  arena_name: string | null;
  hosting_club: string | null;
  home_team_id: number | null;
  home_team_name: string | null;
  home_team_logo: string | null;
  home_team_small_logo: string | null;
  guest_team_id: number | null;
  guest_team_name: string | null;
  guest_team_logo: string | null;
  guest_team_small_logo: string | null;
  live_stream_link: string | null;
  vod_link: string | null;
  result?: { home_goals: number; guest_goals: number } | null;
  result_string?: string | null;
}

export interface LiveStreamDay {
  date: string;
  games: LiveStreamGame[];
}
