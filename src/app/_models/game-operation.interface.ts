import { League } from './league.interface';

export interface GameOperation {
  id: number;
  name: string;
  short_name: string;
  path: string;
  logo_url?: any;
  logo_quad_url?: any;
  top_leagues: League[];
}
