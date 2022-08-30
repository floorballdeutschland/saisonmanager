import { Team } from './team.interface';

export interface League {
  id: number;
  game_operation_id: number;
  game_operation_name: string;
  league_category_id: string;
  league_class_id: string;
  league_system_id: string;
  name: string;
  female: boolean;
  enable_scorer: boolean;
  short_name: string;
  season_id: string;
  order_key: string;
  league_type: 'cup' | 'league';

  legacy_league: boolean;
  field_size: string;
  league_modus: string;
  league_id_preseason?: number;
  league_id_preround?: number;
  has_preround: boolean;
  preround_point_modus?: string;
  preround_scorer_modus?: string;

  table_modus: string;
  periods: number;
  period_length: number;
  overtime_length: number;

  game_day_numbers: number[];
  game_day_titles: Array<{ game_day_number: number; title: string }>;
  similar_leagues?: League[];
}

export interface LeagueWithTeams extends League {
  teams: Team[];
}
