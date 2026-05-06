import { Club } from './club.interface';
import { League } from './league.interface';

export interface GameOperation {
  id: number;
  name: string;
  short_name: string;
  path: string;
  logo_url?: string;
  logo_quad_url?: string;
  top_leagues: League[];
  scan_required: boolean;
}

export interface GameOperationWithLeagues extends GameOperation {
  leagues: League[];
}

export interface GameOperationWithClubs extends GameOperation {
  clubs: Club[];
}
