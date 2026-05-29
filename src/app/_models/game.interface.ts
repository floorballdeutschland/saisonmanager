export interface GameEventLegacy {
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

export type AwardDefinitions = 'mvp';

export type StartingPlayerPosition =
  | 'forward1'
  | 'goal'
  | 'forward2'
  | 'center'
  | 'defender1'
  | 'defender2';

export interface GameEvent {
  event_id: number;
  event_type: string;
  event_team: string;
  period: number;
  time: string;
  home_goals?: number;
  guest_goals?: number;
  number?: number;
  assist?: number;
  goal_type?: string;
  goal_type_string?: string;
  penalty_type?: string;
  penalty_type_string?: string;
  penalty_reason?: number;
  penalty_reason_string?: string;
  // raw IDs for edit pre-fill
  penalty_id?: number;
  penalty_code_id?: number;
}

export interface GamePlayerEntry {
  player_id: number;
  goalkeeper: boolean;
  position?: string;
  player_name: string;
  trikot_number: number;
  player_firstname: string;
  captain?: boolean;
  gender?: string;
  youth?: boolean;
}

export interface GamePlayers {
  home?: GamePlayerEntry[];
  guest?: GamePlayerEntry[];
}

export interface AddLineupPlayerResponse {
  players: GamePlayerEntry[];
  warning: string | null;
}

export interface StartingPlayer {
  position: string;
  team: string;
  player_id: number;
  player_firstname: string;
  player_name: string;
  trikot_number: number;
}

export interface AwardPlayer {
  award: AwardDefinitions;
  position: string;
  team: string;
  player_id: number;
  player_firstname: string;
  player_name: string;
  trikot_number: number;
}

export interface GameResult {
  home_goals: number;
  guest_goals: number;
  home_goals_period: number[];
  guest_goals_period: number[];
  overtime: boolean;
  postfix: {
    long: string;
    short: string;
  };
  forfait: boolean;
}

export interface Referee {
  license_id: string;
  first_name: string;
  last_name: string;
}

export interface Game {
  id: number;
  game_number: string;
  game_status: string;
  ingame_status: string;
  start_time: string;
  date: Date;
  audience: number;
  home_team_id: number;
  home_team_name: string;
  guest_team_name: string;
  home_team_logo: string;
  home_team_small_logo: string;
  guest_team_id: number;
  guest_team_logo: string;
  guest_team_small_logo: string;
  events_legacy: GameEventLegacy[];
  events: GameEvent[];
  players: GamePlayers;
  starting_players: {
    home: StartingPlayer[];
    guest: StartingPlayer[];
  };
  awards: {
    home: AwardPlayer[];
    guest: AwardPlayer[];
  };
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
  game_operation_slug?: string;
  scan_required: boolean;
  arena: number;
  arena_name: string;
  arena_address: string;
  arena_short: string;
  hosting_club?: string;
  referees: Referee[];
  nominated_referees: string;
  period_titles: PeriodTitles[];
  current_period_title: PeriodTitles;
  live_stream_link?: string | null;
  vod_link?: string | null;
  permission?: string[];
  forfait?: number;
  notice_type?: string;
  notice_string?: string;
  special_event_string?: string;

  group_identifier?: string | null;
  series_title?: string | null;
  series_number?: string | null;

  home_team_filling_rule?: string | null;
  home_team_filling_title?: string | null;
  home_team_filling_parameter?: number | null;
  guest_team_filling_rule?: string | null;
  guest_team_filling_title?: string | null;
  guest_team_filling_parameter?: number | null;

  checklist_active?: boolean;
  checklist_items?: { id: number; question: string; position: number }[];
  checklist_answers?: { item_id: number; question: string; answer: boolean }[];

  post_submission_edited?: boolean;
  record_updated_at?: string;
  record_updated_by_name?: string;
}

export interface PeriodTitles {
  period: number;
  short_title: string;
  title: string;
  status_id: string;
  running: boolean;
  can_end_game: boolean;
  optional: boolean;
}

export interface GameInput {
  id?: number;
  forfait?: number;
  game_day_id: number;
  game_number: string;
  start_time: string;
  nominated_referee_string: string;
  notice_type?: string | null;
  notice_string?: string | null;
  home_team_id: number;
  guest_team_id: number;

  group_identifier?: string | null;
  series_title?: string | null;
  series_number?: string | null;

  home_team_filling_rule?: string | null;
  home_team_filling_parameter?: number | null;
  guest_team_filling_rule?: string | null;
  guest_team_filling_parameter?: number | null;
}

export interface GameStatusOption {
  key: string;
  title: string;
  description: string;
  confirm?: boolean;
  confirmationTitle?: string;
  confirmationContent?: string;
  confirmationButton?: string;
}

export interface GameScan {
  filename: string;
  content_type: string;
  byte_size: number;
  expires_at: string;
  url: string;
}
