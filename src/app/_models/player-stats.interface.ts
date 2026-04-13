export interface PlayerStatsLeague {
  league_id: number;
  league_name: string;
  league_slug: string;
  game_operation: string;
  team_id: number;
  team_name: string;
  games: number;
  goals: number;
  assists: number;
  penalty_minutes: number;
}

export interface PlayerStatsSeason {
  season_id: number;
  season_name: string;
  leagues: PlayerStatsLeague[];
}

export interface PlayerStatsTotals {
  games: number;
  goals: number;
  assists: number;
  scorer_points: number;
  scorer_per_game: number;
  last_season: string | null;
}

export interface PlayerStats {
  player: {
    id: number;
    first_name: string;
    last_name: string;
    birthdate: string;
    gender: string;
  };
  seasons: PlayerStatsSeason[];
  totals: PlayerStatsTotals;
}
