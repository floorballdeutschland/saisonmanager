import { ClubMembership } from './club-membership.interface';
import { League } from './league.interface';
import { Team } from './team.interface';

export const PLAYER_GENDERS = { M: 'männlich', W: 'weiblich', D: 'divers' };

export type GenderKey = 'M' | 'W' | 'D' | null;

export interface Player {
  id: number;
  last_name: string;
  first_name: string;
  // Nullable: 292 Profile aus dem Altdaten-Import tragen kein Geburtsdatum.
  birthdate: string | null;
  gender: GenderKey;
  nation_id: number;
  email?: string;
  club_id?: number;
  clubs?: ClubMembership[];
  licenses?: PlayerLicense[];
  security_id?: string;
  deactivated_at?: string;
  current_license_status_id?: number;
  current_license_status?: string;
  current_licenses?: PlayerCurrentLicense[];
  deactivation_reason?: string;
  /**
   * Nur in der Antwort zu einem einzelnen Profil (`admin/players/:id`): Darf
   * der angemeldete Benutzer DIESES Profil deaktivieren und reaktivieren?
   *
   * Je Profil und nicht als Rolle im Browser, weil die Freigabe an
   * Teammanager*innen am einzelnen Verein hängt
   * (`clubs.team_managers_manage_players`). Ein globales Flag zeigte einem
   * Teammanager die Knöpfe entweder in jedem Verein oder in keinem.
   *
   * Fehlt das Feld, ist die API älter als die Freigabe; dann gilt weiter das
   * Rollen-Flag `player_deactivate`.
   */
  can_deactivate?: boolean;
}

// Lizenz-Badge der VM-Spielerliste: ein Eintrag pro Liga-Lizenz der laufenden
// Saison (admin/vm/players.json), höchste Liga zuerst.
export interface PlayerCurrentLicense {
  license_status_id: number;
  license_status: string;
  league_id: number;
  league_short_name: string;
}

export interface PlayerWithLicense extends Player {
  team_license: {
    id: string;
    license: PlayerLicense;
    // Erst-/Zweitlizenz-Rolle (GF-Erwachsenenbereich). Im Team-Lizenzwesen
    // (user_team_licenses) liegt sie direkt auf team_license; in der Liga-
    // Lizenzliste zusätzlich verschachtelt unter license.gf_role.
    gf_role?: GfRole | null;

    last_status: {
      created_at: string;
      created_by: number;
      license_status_id: number;
    };
    last_status_id: number;
    last_status_code: string;

    approved_at?: string;
    requested_at: string;
    // Datum der Vereins-Freigabe (genehmigter Freigabe-Antrag der Saison für
    // den Verein der Mannschaft). Leer bei allen, die keine Freigabe
    // brauchten – eine Zweitvereins-Zugehörigkeit ohne Freigabeverfahren
    // zählt bewusst nicht.
    released_at?: string | null;
    express?: boolean;
    // Je Dokumentart drei Einträge: <key> (liegt vor), <key>_url (Abruf) und
    // <key>_uploaded_at (Zeitpunkt des Uploads, nur gesetzt, wenn auch eine
    // abrufbare Datei hängt).
    documents?: {
      parental_consent: boolean;
      parental_consent_url?: string | null;
      parental_consent_uploaded_at?: string | null;
      [key: string]: boolean | string | null | undefined;
    };
    // Für diesen Spieler tatsächlich erforderliche Dokumentarten-Keys
    // (Altersregeln serverseitig zum Antragsdatum aufgelöst).
    required_documents?: string[];
  };
  current_status?: {
    created_at: Date;
    created_by: number;
    license_status_id: number;
    created_by_name: string;
    license_status: string;
  };
  can_withdraw: boolean;
  grace_period_ends_at?: string;
  other_licenses?: PlayerOtherLicense[];
  // Für diesen Spieler tatsächlich erforderliche Dokumentarten-Keys
  // (Altersregeln serverseitig zum Antragsdatum aufgelöst).
  required_documents?: string[];
}

// Weitere aktive Lizenz eines Spielers (Kontext für die Erst-/Zweitlizenz-
// Zuordnung in der Genehmigungskarte).
export interface PlayerOtherLicense {
  license_id?: string;
  team_name: string;
  league_name?: string;
  last_status_id?: number;
  gf_adult?: boolean;
  female?: boolean;
  gf_role?: GfRole | null;
}

export type GfRole = 'erstlizenz' | 'zweitlizenz';

export interface GfRoleHistoryEntry {
  gf_role: GfRole | null;
  source: 'assign' | 'swap' | 'auto';
  created_by: number | null;
  created_at: string;
}

export interface PlayerLicenseHistory {
  created_at: Date;
  created_by: number;
  reason?: string;
  created_by_name?: string;
  license_status_id: number;
  license_status?: string;
}

export interface PlayerSearchResult {
  id: number;
  last_name: string;
  first_name: string;
  // Nullable: 292 Profile aus dem Altdaten-Import tragen kein Geburtsdatum.
  birthdate: string | null;
  gender: GenderKey;
  club_id: number | null;
  // Gesetzt, wenn der Verein das Profil aus seiner aktiven Liste genommen hat.
  // Die Suche liefert solche Profile bewusst mit: Die Deaktivierung ist eine
  // Kennzeichnung der Vereinsansicht und kein Hindernis fuer eine Aufnahme.
  deactivated_at?: string | null;
  // Darf die angemeldete Rolle dieses Profil oeffnen? Die Suche laeuft ueber den
  // gesamten Bestand, das Profil dahinter ist auf den Heimat-Spielbetrieb
  // begrenzt — ohne diese Angabe boete die Liste Links an, die mit 403 enden.
  // Steht an jedem Treffer, auch am oeffenbaren, damit `false` nicht mit einer
  // Antwort ohne das Feld verwechselt wird.
  manageable?: boolean;
  // Der zustaendige Spielbetrieb, nur an gesperrten Treffern. Fehlt aus zwei
  // Gruenden, die von hier aus nicht zu unterscheiden sind: Das Profil hat keine
  // gueltige Heimat-Zugehoerigkeit, oder sein Heimatverein gehoert zu keinem
  // Spielbetrieb. Der Hinweistext darf deshalb keine Ursache nennen.
  responsible?: string | null;
}

export interface PlayerLicense {
  id: string;
  history: PlayerLicenseHistory[];
  team_id: number;
  season_id?: number | string;
  team?: Team;
  league?: League;
  league_class_id: string;
  requested_at: string;
  set_transfer_allowed?: boolean;
  // Manuelle Erst-/Zweitlizenz-Zuordnung im GF-Erwachsenenbereich.
  gf_role?: GfRole | null;
  gf_role_history?: GfRoleHistoryEntry[];
  // Darf dieses Konto die Zuordnung DIESER Lizenz setzen? Zuständig ist der
  // Verband der Liga, an der die Lizenz hängt – eine Angabe, die der flache
  // permissions-Hash nicht tragen kann, weil er keine Spielbetriebe kennt.
  // Nur von `admin/players/:id` geliefert; fehlt das Feld, entscheidet
  // gfRoleEditable() wie vor api#555 allein über die Fähigkeit.
  gf_role_editable?: boolean;
  // Mannschaft und Liga dieser Lizenz, benannt von den Lizenzlisten einer Liga
  // (League#build_license_items). Die Genehmigungskarte rendert daraus, statt je
  // Zeile `admin/teams/:id` nachzuholen – ein Abruf, der bei einer Lizenz aus
  // einem fremden Spielbetrieb mit 403 endete. Fehlt der Name, ist die
  // Mannschaft gelöscht oder die API älter als api#555.
  team_name?: string | null;
  league_name?: string | null;
}

export interface PlayerSuspension {
  id: number;
  player_id: number;
  team_id: number | null;
  team_name?: string | null;
  kind: 'application_block' | 'license_suspension';
  valid_from: string;
  valid_until: string;
  reason?: string | null;
  active: boolean;
  lifted_at?: string | null;
  affected_licenses_count: number;
  created_at: string;
}
