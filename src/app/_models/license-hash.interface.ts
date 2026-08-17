import { DocumentType } from './document-type.interface';
import { Player, PlayerWithLicense } from './player.interface';
import { Team } from './team.interface';

export interface LicenseHash {
  team: Team;
  current_requests: PlayerWithLicense[];
  other_players: Player[];
  express_license_enabled?: boolean;
  // Die Liga, wegen der die Expresslizenz möglich ist. Sie entscheidet, welche
  // SBK den Antrag bekommt und welcher Verband die Zusatzkosten stellt – das
  // gehört ins Formular, bevor der Verein die Leistung bestellt.
  express_license_league?: { id: number; name: string } | null;
  parental_consent_required?: boolean;
  // Die Liga, die die Zustimmung verlangt. Eine Mannschaft spielt neben ihrer
  // Hauptliga auch in Pokal-Ligen, und jede davon kann das Flag tragen – der
  // Hinweis soll deshalb sagen können, um welche es geht.
  parental_consent_league?: { id: number; name: string } | null;
  required_documents?: string[];
  // Katalog-Metadaten (inkl. template_url) zu allen geforderten Dokumentarten
  // sowie parental_consent.
  document_types?: DocumentType[];
}
