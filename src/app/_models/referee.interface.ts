export interface RefereePublicLicense {
  lizenznummer: number;
  lizenzstufe?: string;
  gueltigkeit?: string;
  landesverband?: string;
  qualifications?: { qualification_type_name?: string; valid_until?: string }[];
}

export interface RefereeQualificationType {
  id: number;
  name: string;
  short_name?: string;
  active: boolean;
  usage_count?: number;
}

export interface RefereeQualificationEntry {
  id?: number;
  qualification_type_id: number;
  qualification_type_name?: string;
  valid_until?: string;
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
  club_id?: number | null;
  club_name?: string;
  landesverband?: string;
  game_operation_id?: number;
  lizenzstufe?: string;
  gueltigkeit?: string;
  active?: boolean;
  qualifications?: RefereeQualificationEntry[];
  wallet_pass_issued_at?: string;
  wallet_pass_url?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  partner_lizenznummer?: number | null;
}

export interface RefereeVm {
  id: number;
  lizenznummer: number | null;
  lizenznummer_display: string;
  vorname: string;
  nachname: string;
  lizenzstufe?: string;
  gueltigkeit?: string;
  active: boolean;
  club_name?: string;
  landesverband?: string;
  qualifications: { qualification_type_name: string; valid_until?: string }[];
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

export interface RefereeAssignmentStub {
  id: number;
  lizenznummer_display: string;
  vorname: string;
  nachname: string;
  lizenzstufe?: string;
  partner_lizenznummer?: number | null;
}

export interface RefereeAssignmentGame {
  id: number;
  game_number: string;
  date: string;
  home_team?: string;
  guest_team?: string;
  league?: string;
  league_category_id?: number;
  season_id?: number;
  arena?: string;
  club?: string;
  result?: string;
}

export interface RefereeAssignment {
  id: number;
  game_id: number;
  status: string;
  notified_tentative_at?: string;
  published_at?: string;
  referee1?: RefereeAssignmentStub | null;
  referee2?: RefereeAssignmentStub | null;
  game?: RefereeAssignmentGame | null;
}

export interface RefereeAssignmentAvailable {
  id: number;
  lizenznummer?: number | null;
  lizenznummer_display: string;
  vorname: string;
  nachname: string;
  lizenzstufe?: string;
  partner_lizenznummer?: number | null;
}

export interface RefereeBlockedDate {
  id: number;
  date: string;
}

export interface PublicLicenseEntry {
  name: string;
  birthdate?: string;
  license_status: string;
  approved_at?: string;
}

export interface RefereeAssignableGame {
  id: number;
  game_number?: string;
  date: string;
  start_time?: string;
  home_team?: string;
  guest_team?: string;
  league?: string;
  arena?: string;
  assignment_id?: number | null;
  assignment_status?: string | null;
}

export interface RefereeGameDayGame {
  id: number;
  game_number?: string;
  start_time?: string;
  home_team?: string;
  guest_team?: string;
  result?: string;
}

export interface RefereeGameDay {
  id: number;
  date: string;
  league?: string;
  arena?: string;
  club?: string;
  my_confirmed_at?: string | null;
  partner_confirmed_at?: string | null;
  auto_confirmed: boolean;
  games: RefereeGameDayGame[];
}

export interface PublicLicenseList {
  game: {
    game_number?: string;
    date: string;
    home_team?: string;
    guest_team?: string;
    league_name: string;
  };
  home_team_licenses: PublicLicenseEntry[];
  guest_team_licenses: PublicLicenseEntry[];
  expires_at: string;
}
