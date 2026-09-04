import { LeagueType } from './league.interface';

export interface AdminLicenseEntry {
  player_id: number;
  player_last_name: string;
  player_first_name: string;
  player_birthdate: string;
  player_gender: 'M' | 'W' | 'D' | null;
  club_id: number | null;
  club_name: string | null;
  team_id: number;
  team_name: string;
  league_id: number;
  league_name: string;
  field_size: string;
  female: boolean;
  age_group: string | null;
  league_category_id: string | null;
  league_category_name: string | null;
  league_class_id: string | null;
  league_class_name: string | null;
  league_type: LeagueType | null;
  league_modus: string | null;
  game_operation_id: number | null;
  game_operation_name: string | null;
  season_id: number | string | null;
  license_id: string;
  // Haupt-/Zusatzlizenz (automatisch bestimmt, reine Anzeige).
  license_type: 'primary' | 'secondary';
  // Manuelle Erst-/Zweitlizenz-Zuordnung im GF-Erwachsenenbereich
  // (Spielberechtigung, z. B. FD-Pokal). null = nicht zugeordnet.
  gf_role: 'erstlizenz' | 'zweitlizenz' | null;
  license_status_id: number;
  license_status: string;
  express: boolean;
  requested_at: string | null;
  approved_at: string | null;
  valid_until: string | null;
  required_documents: string[];
  // Je Dokumentart drei Einträge: <key> (liegt vor), <key>_url (Abruf) und
  // <key>_uploaded_at (Zeitpunkt des Uploads, nur gesetzt, wenn auch eine
  // abrufbare Datei hängt).
  documents: {
    parental_consent: boolean;
    parental_consent_url?: string | null;
    parental_consent_uploaded_at?: string | null;
    [key: string]: boolean | string | null | undefined;
  } | null;
}
