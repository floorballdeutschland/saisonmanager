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

export interface RefereeLicenseLevel {
  id: number;
  name: string;
  active: boolean;
  position?: number;
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
  user_id?: number | null;
  user_name?: string | null;
  email_sent?: boolean;
  duplicate_email?: boolean;
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

export interface RefereeHistoryGame {
  id: number;
  game_number: string;
  date: string;
  home_team: string;
  guest_team: string;
  league: string;
  season_id: number;
  result?: string;
}

export interface RefereeHistorySeason {
  season_id: number;
  season_name: string;
  games: RefereeHistoryGame[];
}

export interface RefereeHistoryTestAttempt {
  id: number;
  online_test_id: number;
  test_name: string;
  lizenzstufe: string | null;
  attempt_number: number;
  completed_at: string;
  error_points: number | null;
  passed: boolean | null;
  pass_threshold_points: number | null;
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
  arena_postcode?: string;
  arena_city?: string;
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

export interface RefereeBlockedDatesBulkResult {
  created: RefereeBlockedDate[];
  skipped: { date: string; reason: string }[];
}

export interface PublicLicenseEntry {
  name: string;
  birthdate?: string;
  license_status: string;
  approved_at?: string;
  valid_until?: string;
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
  arena_postcode?: string;
  arena_city?: string;
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

export interface RefereeChecklistItem {
  id: number;
  question: string;
}

export interface RefereeChecklistAnswer {
  item_id: number;
  question: string;
  answer: boolean;
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
  confirmable_from?: string | null;
  checklist_required: boolean;
  checklist_items: RefereeChecklistItem[];
  properly_conducted?: boolean | null;
  my_checklist_answers: RefereeChecklistAnswer[];
  partner_properly_conducted?: boolean | null;
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
