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
  validity_years?: number;
  usage_count?: number;
}

export interface RefereeQualificationEntry {
  id?: number;
  qualification_type_id: number;
  qualification_type_name?: string;
  valid_until?: string;
}

export interface RefereeTag {
  id: number;
  name: string;
  color?: string | null;
  // Spielbetrieb, dem der Tag zugeordnet ist (null = global). Nur im Katalog
  // relevant; die schlanke Variante an Schiri/Verfügbarkeit liefert nur id/name/color.
  game_operation_id?: number | null;
  usage_count?: number;
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
  season_game_count?: number;
  user_id?: number | null;
  user_name?: string | null;
  email_sent?: boolean;
  duplicate_email?: boolean;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  partner_lizenznummer?: number | null;
  tags?: RefereeTag[];
  tag_ids?: number[];
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
  // Login-Adresse des verknüpften Benutzerkontos (read-only Anzeige; die
  // Pflege läuft über „Mein Konto" und zieht die Schiri-Adresse mit).
  account_email?: string | null;
  telefonnummer?: string;
  lizenzstufe?: string;
  gueltigkeit?: string;
  geburtsdatum?: string;
  verein?: string;
  landesverband?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  partner_lizenznummer?: number | null;
  kurzfristig_mobil?: boolean;
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

export interface RefereeCourseResultCourseData {
  stufe?: string | null;
  datum?: string | null;
  testversion?: string | null;
  punkte?: string | null;
}

export interface RefereeCourseResultSummary {
  id: number;
  lizenzstufe: string | null;
  gueltigkeit: string | null;
  kursstichtag: string | null;
  status: 'pending_review' | 'applied' | 'rejected';
  applied_at: string | null;
  rejection_reason: string | null;
  course_data: {
    kurs_1?: RefereeCourseResultCourseData;
    kurs_2?: RefereeCourseResultCourseData;
    ausbilder?: string | null;
  };
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

export interface AssignmentClub {
  id: number;
  name: string;
}

export interface RefereeAssignment {
  id: number;
  game_id: number;
  status: string;
  notified_tentative_at?: string;
  published_at?: string;
  referee1?: RefereeAssignmentStub | null;
  referee2?: RefereeAssignmentStub | null;
  coach?: RefereeAssignmentStub | null;
  club?: AssignmentClub | null;
  game?: RefereeAssignmentGame | null;
}

export interface RefereeAssignmentAvailable {
  id: number;
  lizenznummer?: number | null;
  lizenznummer_display: string;
  vorname: string;
  nachname: string;
  lizenzstufe?: string;
  kurzfristig_mobil?: boolean;
  partner_lizenznummer?: number | null;
  club_id?: number | null;
  tags?: RefereeTag[];
}

export type RefereeAvailabilityState = 'available' | 'unavailable' | 'assigned';

export interface RefereeAvailabilityWeekend {
  key: string;
  saturday: string;
  sunday: string;
  game_count: number;
}

export interface RefereeAvailabilityReferee {
  id: number;
  lizenznummer_display: string;
  vorname: string;
  nachname: string;
  lizenzstufe?: string;
  states: { [weekendKey: string]: RefereeAvailabilityState };
}

export interface RefereeAvailability {
  weekends: RefereeAvailabilityWeekend[];
  referees: RefereeAvailabilityReferee[];
}

export interface RefereeAvailabilityEntry {
  id: number;
  date: string;
}

export interface RefereeAvailabilityBulkResult {
  created: RefereeAvailabilityEntry[];
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
  home_team_club_id?: number | null;
  guest_team_club_id?: number | null;
  league?: string;
  arena?: string;
  arena_postcode?: string;
  arena_city?: string;
  club?: string;
  national?: boolean;
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
  // Für den Direktlink zur Spielseite: /:association/:leagueId/spiel/:matchId
  league_id?: number;
  game_operation_slug?: string;
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
