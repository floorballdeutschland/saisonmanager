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
      id_copy: boolean;
      parental_consent: boolean;
      id_copy_url?: string | null;
      parental_consent_url?: string | null;
    };
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
  other_licenses?: { team_name: string; league_name?: string }[];
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
  team?: Team;
  league?: League;
  league_class_id: string;
  requested_at: string;
  set_transfer_allowed?: boolean;
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
