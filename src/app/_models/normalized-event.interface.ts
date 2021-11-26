import { GamePlayerEntry } from './game.interface';

export interface Side {
  scorer?: GamePlayerEntry;
  assist?: GamePlayerEntry;
  goals: number;
}

export interface NormalizedEvent {
  time: string;
  period: number;
  home: Side;
  guest: Side;
  penalty_id?: string;
  penalty_code_id?: string;
}
