export interface RefereePublicLicense {
  lizenznummer: number;
  lizenzstufe?: string;
  gueltigkeit?: string;
  landesverband?: string;
  qualifications?: RefereeQualificationDisplay[];
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
  // Kuerzel des Qualifikationstyps, sofern gepflegt. Traegt die Marke in der
  // Verwaltungsliste; fehlt es, steht dort der ausgeschriebene Name.
  qualification_type_short_name?: string | null;
  valid_until?: string;
}

/**
 * Zusatzqualifikation zur Anzeige: im eigenen Profil, auf dem Ausweis und im
 * öffentlichen Lizenzcheck. Rein lesend, deshalb ohne die IDs, die das
 * Verwaltungsformular braucht (siehe RefereeQualificationEntry).
 * `valid_until` ist im Format TT.MM.JJJJ, leer heisst „kein Ablauf hinterlegt“
 * und nicht „abgelaufen“.
 */
export interface RefereeQualificationDisplay {
  qualification_type_name?: string;
  valid_until?: string | null;
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
  // Kuerzel des Landesverbands, nur in der Listenantwort. In der Datenbank
  // optional, deshalb faellt die Spalte „Region" auf den vollen Namen zurueck.
  landesverband_short?: string | null;
  game_operation_id?: number;
  lizenzstufe?: string;
  gueltigkeit?: string;
  active?: boolean;
  license_status?: RefereeLicenseStatus;
  qualifications?: RefereeQualificationEntry[];
  season_game_count?: number;
  // Konto-Badge. Nur in der LISTEN-Antwort und nur fuer Rollen mit Zugriff auf
  // Kontaktdaten (Verwaltung, RSK, Ansetzer); die Detailansicht fuehrt statt
  // dessen user_id/user_name. Fehlt das Feld, wird kein Badge gezeigt.
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

// Ergebnis des CSV-Imports von E-Mailadressen. Jede verarbeitete Datenzeile
// landet in genau einem der vier Toepfe, die vier Groessen ergeben total_rows.
// Leerzeilen der Datei zaehlen nicht mit.
export interface RefereeEmailImportUpdate {
  // Zeilennummer in der Datei (Kopfzeile ist 1). Traegt die Identitaet der Zeile:
  // dieselbe Lizenznummer kann mehrfach in der Datei stehen.
  row: number;
  id: number;
  lizenznummer: number;
  name: string;
  // Die Adresse, die jetzt im Profil steht.
  email: string;
}

// Uebersprungene Zeile: Im Profil stand schon eine Adresse. `email` ist die
// verbliebene, `csv_email` die aus der Datei.
export interface RefereeEmailImportSkip extends RefereeEmailImportUpdate {
  csv_email: string;
  reason: 'identical' | 'other_email';
}

// Unbrauchbare Zeile. `message` ist freier Text und wird unuebersetzt angezeigt,
// im Unterschied zum Schluessel `reason` der uebersprungenen Zeilen.
export interface RefereeEmailImportInvalidRow {
  row: number;
  value: string;
  reason: string;
}

export interface RefereeEmailImportReport {
  // Verarbeitete Datenzeilen, ohne Kopf- und Leerzeilen.
  total_rows: number;
  updated: RefereeEmailImportUpdate[];
  skipped: RefereeEmailImportSkip[];
  // Lizenznummern ohne aktiven Schiedsrichter, je Zeile einmal (also mit
  // Wiederholungen, damit die Summe der vier Toepfe total_rows ergibt).
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
  // false = Konto angelegt, Willkommensmail aber nicht rausgegangen. Dann kennt
  // der Schiedsrichter sein Initialpasswort nicht und braucht ein Zuruecksetzen.
  email_sent: boolean;
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
  // Vereins-ID zum Namen: Die Vereinsauswahl im Korrekturantrag blendet den
  // eigenen Verein aus, und über den Namen wäre das bei zwei gleichnamigen
  // Vereinen der falsche.
  club_id?: number | null;
  landesverband?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  partner_lizenznummer?: number | null;
  kurzfristig_mobil?: boolean;
  club_exclusions?: RefereeClubExclusion[];
  club_exclusion_requests?: RefereeClubExclusionRequest[];
  // Korrekturanträge zu den gesperrten Stammdaten (Name, Geburtsdatum, Verein).
  change_requests?: RefereeChangeRequest[];
  // Zusatzqualifikationen samt Gültigkeit, von der RSK gepflegt und hier nur
  // angezeigt. Nach Namen sortiert von der API.
  qualifications?: RefereeQualificationDisplay[];
}

// Feld, für das eine Korrektur beantragt werden kann. Die Werte sind die
// correction_type der API.
export type RefereeCorrectionType =
  | 'vorname'
  | 'nachname'
  | 'geburtsdatum'
  | 'verein';

export interface RefereeChangeRequest {
  id: number;
  referee_id: number;
  correction_type: RefereeCorrectionType;
  // Deutsche Feldbezeichnung aus der API (für Mail und Verlauf).
  label: string;
  // Roher neuer Wert; beim Geburtsdatum ISO (JJJJ-MM-TT), beim Verein null.
  new_value?: string | null;
  new_club_id?: number | null;
  new_club_name?: string | null;
  // Stand am Profil zum Abrufzeitpunkt bzw. der beantragte Wert, beide bereits
  // als Text: Beim Verein steht hier der Name und nicht die ID.
  current_value?: string | null;
  requested_value?: string | null;
  reason?: string | null;
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

export interface RefereeChangeRequestPayload {
  change_requests: RefereeChangeRequest[];
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
  // league_id + game_operation_slug tragen den Link zur öffentlichen
  // Spielseite: /:association/:leagueId/spiel/:matchId. Gleiche Felder wie in
  // RefereeHistoryGame.
  league_id?: number | null;
  game_operation_slug?: string | null;
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

// Gespann-Historie: mit wem diese Person laut Spielbericht tatsächlich im
// Einsatz war, über alle Saisons. Dieselbe Nutzlast liefern die RSK-/Ansetzer-
// Sicht (GET admin/referees/:id/partners) und die Eigensicht
// (GET referee/history/partners).
//
// Der Server rendert einen vollständigen Hash, lässt also keinen Schlüssel weg:
// Ein nullbares Feld kommt als `null` an, nie als `undefined`. Deshalb hier
// durchgehend `| null` statt `?`.
export interface RefereePartnerHistory {
  referee: {
    id: number;
    vorname: string;
    nachname: string;
    lizenznummer_display: string;
  };
  season_id: number;
  // Serverseitiger Hinweis zur Belastbarkeit der Altdaten.
  notice: string;
  // Absteigend nach Einsätzen der laufenden Saison, dann nach Gesamtzahl.
  partners: RefereePartnerHistoryEntry[];
}

export interface RefereePartnerHistoryEntry {
  referee_id: number;
  vorname: string;
  nachname: string;
  lizenznummer_display: string;
  lizenzstufe: string | null;
  club_name: string | null;
  games_current_season: number;
  // Mindestens 1: Ein Eintrag ohne gemeinsames Spiel entsteht nicht.
  games_total: number;
  // Jüngste Saison mit gemeinsamem Einsatz. `leagues.season_id` ist
  // serverseitig varchar, wird für diese Antwort aber nach Integer gewandelt.
  last_season_id: number;
  last_season_name: string;
  // Gültige Lizenz zum Abfragezeitpunkt.
  active: boolean;
  game_operations: RefereePartnerGameOperation[];
}

export interface RefereePartnerGameOperation {
  game_operation_id: number;
  game_operation_name: string | null;
  game_count: number;
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
