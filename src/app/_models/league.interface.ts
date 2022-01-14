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
  game_day_numbers: number[];
  game_day_titles: {
    [key: string]: string;
  };
  similar_leagues?: League[];
}
