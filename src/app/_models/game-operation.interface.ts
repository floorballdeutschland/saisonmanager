import { League } from './league.interface';

export interface GameOperation {
  id: number;
  name: string;
  short_name: string;
  path: string;
  logo_url?: string;
  logo_quad_url?: string;
  top_leagues: League[];
}

export interface GameOperationWithLeagues extends GameOperation {
  leagues: League[];
}
