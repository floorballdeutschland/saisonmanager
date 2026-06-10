import { Player, PlayerWithLicense } from './player.interface';
import { Team } from './team.interface';

export interface LicenseHash {
  team: Team;
  current_requests: PlayerWithLicense[];
  other_players: Player[];
  express_license_enabled?: boolean;
  parental_consent_required?: boolean;
  required_documents?: string[];
}
