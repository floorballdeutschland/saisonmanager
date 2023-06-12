import { Game } from './game.interface';
import { Arena } from './arena.interface';

export interface Gameday {
  id: number;
  number: number;
  date: string;
  arena_id: number;
  club_id: number;
  league_id: number;
  deletable: boolean;
}

export interface GamedayInput {
  id?: number;
  number: number;
  date: string;
  arena_id: number;
  club_id: number;
  league_id: number;
  deletable?: boolean;
}

export interface GamedayWithGames {
  id: number;
  number: number;
  date: string;
  arena_id: number;
  arena: Arena;
  club_id: number;
  league_id: number;
  games: Game[];
}
