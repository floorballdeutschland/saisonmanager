import { GameOperation, Season } from '.';

export interface InitData {
  seasons: Season[];
  current_season_id: number;
  game_operations: GameOperation[];
}
