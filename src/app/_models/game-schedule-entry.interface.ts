import { GameResult, PeriodTitles, Referee } from './game.interface';

export interface GameScheduleEntry {
  game_id: number;
  game_number: number;
  game_day: number;
  arena: number;
  arena_name: string;
  arena_address: string;
  arena_short: string;
  current_period_title: PeriodTitles;
  hosting_club: string;
  game_day_id: number;
  date: string;
  time: string;
  home_team_name: string;
  home_team_logo: string;
  home_team_small_logo: string;
  guest_team_name: string;
  guest_team_logo: string;
  guest_team_small_logo: string;
  nominated_referee_string: string;
  notice_type: string;
  notice_string: string;
  referees: Referee[];
  state: 'record_created' | 'no_record';
  result_string: string;
  result: GameResult;
  ended: boolean;
  started: boolean;

  group_identifier?: string | null;
  title?: string | null; // TODO: remove this

  home_team_filling_rule?: string | null;
  home_team_filling_title?: string | null;
  home_team_filling_parameter?: number | null;
  guest_team_filling_rule?: string | null;
  guest_team_filling_title?: string | null;
  guest_team_filling_parameter?: number | null;
}

export interface FinalRound {
  round_title: string;
  matches: GameScheduleEntry[];
}
