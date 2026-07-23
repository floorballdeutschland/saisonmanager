export interface TeamScorerEntry {
  player_id: number;
  first_name: string;
  last_name: string;
  games: number;
  goals: number;
  assists: number;
  scorer_points: number;
  penalty_minutes: number;
}

export interface TeamRecentGame {
  game_id: number;
  game_number: string;
  home_team_name: string;
  home_team_logo: string | null;
  guest_team_name: string;
  guest_team_logo: string | null;
  home_goals: number | null;
  guest_goals: number | null;
  date: string;
  start_time?: string;
  league_id: number;
  league_name?: string;
  league_short_name?: string;
}

export interface TeamStatsTotals {
  goals: number;
  assists: number;
  penalty_minutes: number;
}

export interface TeamLeague {
  id: number;
  name: string;
  short_name?: string;
  game_operation_slug: string;
}

export interface TeamInfo {
  id: number;
  name: string;
  short_name: string;
  league_id: number;
  league_name: string;
  leagues: TeamLeague[];
  game_operation_slug: string;
  game_operation_short_name: string;
  logo_url: string | null;
  logo_small: string | null;
}

export interface TeamStats {
  team: TeamInfo;
  scorer: TeamScorerEntry[];
  recent_games: TeamRecentGame[];
  upcoming_games: TeamRecentGame[];
  totals: TeamStatsTotals;
}
