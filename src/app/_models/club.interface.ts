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
  contact_email?: string;
  /**
   * Nur in der Antwort zu einem einzelnen Verein (`admin/clubs/:id`): Darf der
   * angemeldete Benutzer bei DIESEM Verein die einordnenden Felder
   * (Bundesland, Landesverband, Spielbetrieb) ändern? Die Berechtigung gilt pro
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
