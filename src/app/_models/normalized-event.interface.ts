import { GamePlayerEntry } from './game.interface';

export interface Side {
  scorer?: GamePlayerEntry;
  assist?: GamePlayerEntry;
  goals?: number;
}

export interface NormalizedEvent {
  event_id: number;
  event_type: string;
  event_team: string;
  time: string;
  period: number;
  home: Side;
  guest: Side;
  penalty_type?: string;
  penalty_type_string?: string;
  penalty_reason?: number;
  penalty_reason_string?: string;
  goal_type_string?: string;
  goal_type?: string;
}
