export interface RefereePublicLicense {
  lizenznummer: number;
  lizenzstufe?: string;
  gueltigkeit?: string;
  zusatzqualifikation?: string;
  gueltigkeit_z?: string;
  verein?: string;
}

export interface RefereeAdmin {
  id: number;
  lizenznummer: number | null;
  lizenznummer_display: string;
  guest: boolean;
  vorname: string;
  nachname: string;
  geburtsdatum?: string;
  email?: string;
  verein?: string;
  landesverband?: string;
  game_operation_id?: number;
  lizenzstufe?: string;
  gueltigkeit?: string;
  active?: boolean;
  zusatzqualifikation?: string;
  gueltigkeit_z?: string;
  wallet_pass_issued_at?: string;
  wallet_pass_url?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  partner_lizenznummer?: number | null;
}

export interface RefereeProfile {
  id: number;
  lizenznummer: number | null;
  lizenznummer_display: string;
  vorname: string;
  nachname: string;
  email?: string;
  lizenzstufe?: string;
  gueltigkeit?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  partner_lizenznummer?: number | null;
}

export interface RefereeAdminGame {
  id: number;
  game_number: string;
  date: string;
  home_team: string;
  guest_team: string;
  league: string;
  season_id: number;
  result?: string;
  referee1?: string;
  referee2?: string;
}
