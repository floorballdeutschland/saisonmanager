import { DocumentType } from './document-type.interface';
import { Player, PlayerWithLicense } from './player.interface';
import { Team } from './team.interface';

export interface LicenseHash {
  team: Team;
  current_requests: PlayerWithLicense[];
  other_players: Player[];
  express_license_enabled?: boolean;
  // Die Liga, wegen der die Expresslizenz möglich ist. Im System hängt daran der
  // Empfänger der Benachrichtigung (die SBK ihres Spielbetriebs, per
  // effective_sbk_email notfalls die des Verbunds); die Zusatzkosten sind eine
  // Regel der Gebührenordnung und stehen nirgends im Code. Beides gehört ins
  // Formular, bevor der Verein die kostenpflichtige Leistung bestellt.
  //
  // Die API leitet express_license_enabled aus demselben Aufruf ab, für eine
  // aktuelle API gilt also `enabled === (league != null)`. Der zusätzliche Guard
  // im Template deckt nur eine ältere API ab, die das Feld noch nicht liefert.
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
