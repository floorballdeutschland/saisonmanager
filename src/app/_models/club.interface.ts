import { Team } from './team.interface';
export interface Club {
  id: number;
  name: string;
  short_name: string;
  long_name: string;
  state: string;
  game_operation_id: number;
  additional_game_operation_ids: number[];
  logo?: string;
}

export interface ClubWithTeams extends Club {
  teams: Team[];
}
