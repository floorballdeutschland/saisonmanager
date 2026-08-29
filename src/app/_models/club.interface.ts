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
  /**
   * Darf der Verein das Anlegen, Deaktivieren und Reaktivieren von
   * Spieler*innen seinen Teammanager*innen überlassen? Der Verein stellt das
   * selbst ein; ohne den Haken bleibt es beim Vereinsmanager (api#530).
   *
   * Anders als `edit_restricted` und `manage_players` keine benutzerbezogene
   * Angabe, sondern ein Feld des Vereins: dasselbe für jeden, der den Verein
   * ansieht. Wer daraus ableiten will, ob der ANGEMELDETE Benutzer anlegen
   * darf, liest `manage_players` aus `vm/clubs_and_teams`.
   */
  team_managers_manage_players?: boolean;
  players?: Player[];
  logo?: string;
  logo_url?: string;
  logo_small_url?: string;
  deactivated_at?: string;
  deactivated_by?: number;
  /**
   * Nur in der Vereinsliste der Verwaltung (`admin/clubs/all.json`): Ist der
   * Verein deaktiviert? Masken, die einen Verein zuweisen UND den bereits
   * gespeicherten benennen, grenzen damit nur ihre Auswahl ein und behalten die
   * volle Liste zum Nachschlagen. `deactivated_at` selbst liefert dieser
   * Endpunkt bewusst nicht, er teilt seine Darstellung mit den öffentlichen
   * Endpunkten.
   */
  deactivated?: boolean;
}

export interface ClubWithTeams extends Club {
  teams: Team[];
  /**
   * Nur aus `vm/clubs_and_teams`: Darf der angemeldete Benutzer den
   * Spielerbestand DIESES Vereins ordnen, also anlegen, deaktivieren und
   * reaktivieren (api#530)? Serverseitig aus `Club#user_permissions`, also aus
   * derselben Quelle wie die Prüfung beim Schreiben. Ein Flag am Benutzer
   * könnte das nicht abbilden: Die Liste enthält auch Vereine, in denen der
   * Benutzer nur Teammanager ist, und `permissions` im Browser kennt weder den
   * Spielbetrieb eines Vereins noch eine Rechteänderung seit der Anmeldung.
   */
  manage_players?: boolean;
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
