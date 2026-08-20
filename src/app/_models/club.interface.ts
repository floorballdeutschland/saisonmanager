import { Player } from './player.interface';
import { Team } from './team.interface';

export interface Club {
  id: number;
  name: string;
  short_name: string;
  long_name: string;
  state: string;
  state_association_id?: number;
  /**
   * Nur lesend: Der zuständige Spielbetrieb wird serverseitig aus dem
   * Landesverband abgeleitet (Club#main_game_operation_id) und lässt sich nicht
   * setzen. `null`, wenn kein Verband zuständig ist. Vorher war das ein am
   * Verein gepflegtes Feld, das dem Landesverband widersprechen konnte.
   */
  game_operation_id?: number | null;
  contact_email?: string;
  /**


   * Vereinsmanager, die die Vereinspost zusätzlich zur Kontakt-E-Mail
   * bekommen. Kommt nicht aus dem Vereins-Datensatz, sondern aus
   * `admin/clubs/:id/managers` – der volle Vereins-Hash reist serverseitig
   * durch jede Spieltags-Antwort, dort haben Benutzerdaten nichts zu suchen.
   */
  notify_user_ids?: number[];
  /**
   * Nur in der Antwort zu einem einzelnen Verein (`admin/clubs/:id`): Darf der
   * angemeldete Benutzer bei DIESEM Verein die einordnenden Felder
   * (Bundesland, Landesverband) ändern? Die Berechtigung gilt pro
   * Verein, ein Flag am Benutzer kann Mehrfachrollen nicht abbilden.
   */
  edit_restricted?: boolean;
  players?: Player[];
  logo?: string;
  logo_url?: string;
  logo_small_url?: string;
  deactivated_at?: string;
  deactivated_by?: number;
}

export interface ClubWithTeams extends Club {
  teams: Team[];
}

/** Vereinsmanager eines Vereins, Auswahlliste für die Vereinspost. */
export interface ClubManager {
  id: number;
  name: string;
  user_name: string;
  email?: string;
}

export interface ClubManagerList {
  notify_user_ids: number[];
  managers: ClubManager[];
}
