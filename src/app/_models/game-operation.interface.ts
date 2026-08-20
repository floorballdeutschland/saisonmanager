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
  // Hebt SBK, RSK und Ansetzer dieses Spielbetriebs auf globalen Scope
  // (User#permission_hash in der API). Steht nur in den Admin-Antworten, nicht
  // im öffentlichen meta_hash.
  national?: boolean;
}

// Der Datensatz der Spielbetriebs-Verwaltung
// (GET admin/game_operations/:id). `path` ist hier der gespeicherte Wert, `slug`
// der daraus abgeleitete – die Maske muss zeigen, was in der Spalte steht,
// sonst schreibt das Speichern die Ableitung als eigenen Wert fest.
export interface GameOperationAdmin {
  id: number;
  name: string;
  short_name: string;
  path: string;
  slug: string;
  national: boolean;
  state_association_id: number | null;
  state_association_name: string | null;
  banner_url?: string | null;
  banner_link_url?: string | null;
  dependencies: GameOperationDependencies;
}

// Was am Spielbetrieb hängt. Jede Zahl ist ein Riegel gegen das Löschen; die
// Maske zeigt sie, damit vor dem Klick dasteht, was im Weg ist.
export interface GameOperationDependencies {
  leagues: number;
  clubs: number;
  users: number;
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
