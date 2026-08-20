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

/**
 * Zustand der Schiedsrichter-Lizenz, berechnet von der API.
 *
 * `career_ended` heißt vier Lizenzjahre ohne Lizenz: Die Karriere gilt als
 * beendet, für eine Rückkehr ist der Grundkurs fällig, nicht die Fortbildung.
 * `unknown` sind Datensätze ohne Ablaufdatum, etwa frisch angelegte.
 */
export type RefereeLicenseStatus =
  | 'active'
  | 'lapsed'
  | 'career_ended'
  | 'unknown';

/** Filterwerte der Verwaltungsliste. Leer = Standard, also ohne Beendete. */
export type RefereeStatusFilter =
  | ''
  | 'alle'
  | 'aktiv'
  | 'abgelaufen'
  | 'beendet'
  | 'ohne_nachweis';

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
  license_status?: RefereeLicenseStatus;
  qualifications?: RefereeQualificationEntry[];
  season_game_count?: number;
  // Konto-Badge der Liste. Fehlt fuer Rollen ohne Zugriff auf Kontaktdaten
  // (Vereinsmanager) - die API liefert das Feld dort gar nicht mit.
  has_user?: boolean;
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

// Ergebnis des CSV-Imports von E-Mailadressen. Jede Zeile der Datei landet in
// genau einem der vier Toepfe.
export interface RefereeEmailImportEntry {
  id: number;
  lizenznummer: number;
  name: string;
  // Die Adresse, die jetzt im Profil steht.
  email: string;
  // Nur bei uebersprungenen Zeilen: was in der CSV stand.
  csv_email?: string;
  reason?: 'identical' | 'other_email';
}

export interface RefereeEmailImportInvalidRow {
  row: number;
  value: string;
  reason: string;
}

export interface RefereeEmailImportReport {
  total_rows: number;
  updated: RefereeEmailImportEntry[];
  skipped: RefereeEmailImportEntry[];
  not_found: number[];
  invalid: RefereeEmailImportInvalidRow[];
}

export interface RefereeMissingUserCount {
  count: number;
  batch_size: number;
}

export interface RefereeBulkUserCreated {
  id: number;
  lizenznummer: number;
  name: string;
  email: string;
  user_name: string;
  duplicate_email: boolean;
}

export interface RefereeBulkUserFailure {
  id: number;
  lizenznummer: number;
  name: string;
  error: string;
}

export interface RefereeBulkUserResult {
  requested: number;
  created: RefereeBulkUserCreated[];
  failed: RefereeBulkUserFailure[];
  // Wie viele Konten nach diesem Durchlauf noch offen sind (Fehlgeschlagene
  // zaehlen mit, sie erfuellen die Bedingungen weiter).
  remaining: number;
  batch_size: number;
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
  club_exclusions?: RefereeClubExclusion[];
  club_exclusion_requests?: RefereeClubExclusionRequest[];
}

// Ein Verein, für den die Person nicht angesetzt werden möchte. „own_club" ist
// der eigene Verein und wird serverseitig aus der Vereinszugehörigkeit
// abgeleitet, steht also immer auf der Liste und ist nicht streichbar.
export interface RefereeClubExclusion {
  // null beim abgeleiteten Eintrag des eigenen Vereins (keine gespeicherte Zeile).
  id?: number | null;
  club_id: number;
  club_name: string;
  source: 'own_club' | 'assigned';
  reason?: string | null;
  since?: string | null;
  can_request_removal: boolean;
}

export interface RefereeClubExclusionRequest {
  id: number;
  referee_id: number;
  club_id: number;
  club_name?: string;
  kind: 'add' | 'remove';
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  decision_note?: string | null;
  decided_at?: string | null;
  created_at?: string;
  referee?: {
    id: number;
    lizenznummer_display: string;
    vorname: string;
    nachname: string;
    club_name?: string | null;
  };
}

export interface RefereeClubExclusionPayload {
  club_exclusions: RefereeClubExclusion[];
  club_exclusion_requests: RefereeClubExclusionRequest[];
}

export interface ExclusionClub {
  id: number;
  name: string;
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
  // league_id + game_operation_slug tragen den Link zur öffentlichen
  // Spielseite: /:association/:leagueId/spiel/:matchId.
  league_id?: number | null;
  game_operation_slug?: string | null;
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

// Laut Spielbericht tatsächlich eingesetzter Schiedsrichter. `id` fehlt bei
// Gästen und Altdaten ohne verknüpften Schiedsrichter-Datensatz.
export interface RefereeAssignmentOfficial {
  id?: number | null;
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
  // Positionstreu je Slot (Schiri 1/2), null = kein Eintrag im Spielbericht.
  // Nur die Listen-Antwort füllt das Feld.
  officials?: (RefereeAssignmentOfficial | null)[];
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
  // Vereine, für die die Person nicht angesetzt werden möchte (eigener Verein
  // plus genehmigte Ausschlüsse). Rein informativ: Die Ansetzung warnt bei der
  // Auswahl, die Person bleibt wählbar.
  excluded_club_ids?: number[];
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
  league_id?: number | null;
  // Spielbetrieb der Liga: unterscheidet gleichnamige Ligen verschiedener
  // Verbände in der Ligaauswahl.
  game_operation?: string | null;
  // Spieltag als Gruppierungs-Einheit der Anzeige. Über das Datum allein ginge
  // das nicht, denn zwei Spieltage derselben Liga können auf denselben Tag
  // fallen.
  game_day_id?: number | null;
  game_day_number?: number | null;
  arena?: string;
  arena_postcode?: string;
  arena_city?: string;
  club?: string;
  national?: boolean;
  assignment_id?: number | null;
  assignment_status?: string | null;
  // Markierung „wird personenscharf angesetzt". Im reduzierten Modus (Weg 3)
  // sperrt sie die Zeile, damit nicht zwei Wege dasselbe Spiel bearbeiten.
  person_level_assignment?: boolean;
  locked?: boolean;
  // Aktueller Freitext im Spielplan – im reduzierten Modus das Eingabefeld.
  nominated_referee_string?: string | null;
  assignment_club_id?: number | null;
  // Freitext-Spielinformationen des Ansetzers, nur für das angesetzte Gespann
  // und den SR-Coach sichtbar (nie für die Mannschaften).
  referee_notes?: string | null;
  referee_notes_updated_at?: string | null;
  referee_notes_updated_by_name?: string | null;
}

// Antwort des reduzierten Modus (Weg 3) nach dem Speichern von Verein bzw. Freitext.
export interface ClubAssignmentResult {
  game_id: number;
  nominated_referee_string: string | null;
  assignment_club_id?: number | null;
  assignment_id?: number | null;
}

export interface RefereeGameNotes {
  game_id: number;
  referee_notes?: string | null;
  referee_notes_updated_at?: string | null;
  referee_notes_updated_by_name?: string | null;
}

export interface RefereeGameDayGame {
  id: number;
  game_number?: string;
  start_time?: string;
  home_team?: string;
  guest_team?: string;
  result?: string;
  // Hinweis des Ansetzers an das Gespann; nur gefüllt, wenn man selbst
  // (veröffentlicht) angesetzt ist.
  referee_notes?: string | null;
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
  // Nur als SR-Coach (Beobachter) angesetzt. Rein für die Anzeige der Rolle:
  // Dass an so einem Spieltag nichts zu bestätigen ist, steuert das Backend
  // über checklist_required (false) und einen leeren Partner-Status.
  coach_only?: boolean;
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
