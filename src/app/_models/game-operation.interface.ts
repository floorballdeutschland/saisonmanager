import { Club } from './club.interface';
import { League } from './league.interface';

export interface GameOperation {
  id: number;
  name: string;
  short_name: string;
  path: string;
  // Kommt ausschließlich aus dem Logo-Upload des Landesverbands und ist ohne
  // hinterlegtes Logo nicht gesetzt (siehe saisonmanager-api#276).
  logo_url?: string;
  banner_url?: string | null;
  banner_link_url?: string | null;
  top_leagues: League[];
  scan_required?: boolean;
  state_association_id?: number | null;
}

export interface GameOperationWithLeagues extends GameOperation {
  leagues: League[];
}

// Gruppe der Vereinsverwaltung: ein Landesverband mit seinen Vereinen.
// Die Gruppierung folgt dem am Verein eingestellten Landesverband
// (clubs.state_association_id), nicht mehr dem Spielbetrieb. Welche Vereine ein
// Nutzer sieht, richtet sich unverändert nach seinen Spielbetriebs-Rechten –
// siehe Club.admin_user_clubs in der API. `released` markiert Gruppen, die nur
// über eine LV-Freigabe lesend sichtbar sind.
// Kein `id`: der Endpunkt sendet für diese zusammengesetzten Gruppen `id: null`.
// Als Feld deklariert wäre es ein Fallstrick – `track group.id` im @for würde
// sauber typprüfen und dann bei mehr als einer Gruppe an Angulars
// Duplicate-Key-Fehler laufen. `state_association_id` taugt aus demselben Grund
// nicht als Schlüssel: null für „Eigene Vereine" und „Ohne Landesverband", und
// eine Freigabe-Gruppe teilt den Wert mit der regulären Gruppe desselben
// Landesverbands.
export interface StateAssociationWithClubs {
  name: string;
  short_name: string | null;
  logo_url?: string | null;
  state_association_id: number | null;
  released?: boolean;
  clubs: Club[];
}
