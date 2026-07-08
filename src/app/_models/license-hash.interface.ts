import { DocumentType } from './document-type.interface';
import { Player, PlayerWithLicense } from './player.interface';
import { Team } from './team.interface';

export interface LicenseHash {
  team: Team;
  current_requests: PlayerWithLicense[];
  other_players: Player[];
  express_license_enabled?: boolean;
  parental_consent_required?: boolean;
  required_documents?: string[];
  // Katalog-Metadaten (inkl. template_url) zu allen geforderten Dokumentarten
  // sowie parental_consent.
  document_types?: DocumentType[];
}
