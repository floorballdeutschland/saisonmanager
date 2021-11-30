export interface GameEvent {
  row: number;
  time: string;
  period: number;
  home_goals: number;
  guest_goals: number;
  home_assist: number;
  home_number: number;
  penalty_id: string;
  penalty_code_id: string;
  guest_number?: number;
  guest_assist?: number;
}

export interface GamePlayerEntry {
  player_id: number;
  goalkeeper: boolean;
  position?: string;
  player_name: string;
  trikot_number: number;
  player_firstname: string;
  captain?: boolean;
}

export interface GamePlayers {
  home: GamePlayerEntry[];
  guest: GamePlayerEntry[];
}

export interface GameResult {
  home_goals: number;
  guest_goals: number;
  home_goals_period: number[];
  guest_goals_period: number[];
  overtime: boolean;
}

export interface Game {
  id: number;
  game_number: string;
  start_time: string;
  date: Date;
  audience: number;
  home_team_name: string;
  guest_team_name: string;
  events: GameEvent[];
  players: GamePlayers;
  started: boolean;
  ended: boolean;
  result_string: string;
  result: GameResult;
  league_id: number;
  league_name: string;
  league_short_name: string;
  game_operation_id: number;
  game_operation_name: string;
  game_operation_short_name: string;
  arena: number;
  arena_name: string;
  arena_address: string;
  arena_short: string;
}
