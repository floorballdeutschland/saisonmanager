import { Player } from './player.interface';
import { Team } from './team.interface';

export interface Club {
  id: number;
  name: string;
  short_name: string;
  long_name: string;
  state: string;
  state_association_id?: number;
  game_operation_id: number;
  additional_game_operation_ids: number[];
  contact_email?: string;
  players?: Player[];
  logo?: string;
  logo_url?: string;
  logo_small_url?: string;
}

export interface ClubWithTeams extends Club {
  teams: Team[];
}
