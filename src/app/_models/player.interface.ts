import { ClubMembership } from './club-membership.interface';

export interface Player {
  id: number;
  last_name: string;
  first_name: string;
  birthdate: string;
  male: boolean;
  nation_id: number;
  club_id?: number;
  clubs?: ClubMembership[];
  licenses?: PlayerLicense[];
  security_id?: string;
}

export interface PlayerWithLicense extends Player {
  team_license: {
    license: PlayerLicense;

    last_status: {
      created_at: string;
      created_by: number;
      license_status_id: number;
    };
    last_status_id: number;
    last_status_code: string;

    approved_at?: number;
    requested_at: string;
  };
  current_status: {
    created_at: Date;
    created_by: number;
    license_status_id: number;
    created_by_name: string;
    license_status: string;
  };
  can_withdraw: boolean;
}

export interface PlayerLicenseHistory {
  created_at: Date;
  created_by: number;
  license_status_id: number;
}

export interface PlayerLicense {
  id: string;
  male: boolean;
  history: PlayerLicenseHistory[];
  team_id: number;
  league_class_id: string;
  requested_at: string;
}
