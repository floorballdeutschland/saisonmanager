export interface Player {
  id: number;
  last_name: string;
  first_name: string;
  birthdate: string;
  male?: boolean;
  security_id: string;
}

export interface PlayerWithLicense extends Player {
  team_license: PlayerLicense;
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
}
