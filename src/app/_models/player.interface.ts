import { ClubMembership } from './club-membership.interface';
import { League } from './league.interface';
import { Team } from './team.interface';

export const PLAYER_GENDERS = { M: 'männlich', W: 'weiblich', D: 'divers' };

export type GenderKey = 'M' | 'W' | 'D' | null;

export interface Player {
  id: number;
  last_name: string;
  first_name: string;
  birthdate: string;
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
  deactivation_reason?: string;
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
    express?: boolean;
    documents?: {
      parental_consent: boolean;
      parental_consent_url?: string | null;
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
  birthdate: string;
  gender: GenderKey;
  club_id: number | null;
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
