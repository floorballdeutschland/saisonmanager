import { League } from './league.interface';
import { GameOperation } from './game-operation.interface';

export interface LeagueWithOperation {
  league: League;
  operation: GameOperation;
}
