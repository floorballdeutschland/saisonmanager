import { Player, PlayerWithLicense } from './player.interface';
import { Team } from './team.interface';

export interface LicenseHash {
  team: Team;
  current_requests: PlayerWithLicense[];
  other_players: Player[];
}
