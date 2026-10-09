/**
 * Schiedsrichterkurse im System (`admin/referee_courses`). Lösen den CSV-Import
 * der Kursergebnisse ab.
 */
export type RefereeCourseType =
  | 'j'
  | 'g'
  | 'f'
  | 'combined'
  | 'module'
  | 'refresher'
  | 'n'
  | 'a'
  | 'retest'
  | 'other';

export type RefereeCourseFormat = 'in_person' | 'online' | 'hybrid';

export type RefereeCourseStatus =
  | 'draft'
  | 'published'
  | 'registration_closed'
  | 'held'
  | 'results_submitted'
  | 'cancelled';

/** Spiegelt `RefereeCourse::TRANSITIONS` der API. */
export const REFEREE_COURSE_TRANSITIONS: Record<
  RefereeCourseStatus,
  RefereeCourseStatus[]
> = {
  draft: ['published', 'cancelled'],
  published: ['registration_closed', 'held', 'cancelled', 'draft'],
  registration_closed: ['published', 'held', 'cancelled'],
  held: ['registration_closed'],
  results_submitted: [],
  cancelled: ['draft'],
};

export interface RefereeCourseSession {
  starts_at: string;
  ends_at?: string | null;
  format?: 'in_person' | 'online' | null;
  location?: string | null;
  online_url?: string | null;
}

export type RefereeCourseFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multi_select'
  | 'checkbox'
  | 'number'
  | 'date';

export interface RefereeCourseField {
  id?: number;
  label: string;
  field_type: RefereeCourseFieldType;
  options: string[];
  required: boolean;
  position?: number;
  help_text?: string | null;
  visible_to_lead: boolean;
  include_in_billing_export: boolean;
  archived?: boolean;
}

export interface RefereeCourseLeadEntry {
  id: number;
  user_id: number;
  name: string;
  user_name: string;
  lead: boolean;
  /** Nur in der Antwort auf das Zuordnen: neues Konto mit Einladung. */
  invited?: boolean;
}

/** Zuordnen einer Kursleitung: genau einer der drei Wege. */
export type RefereeCourseLeadInput =
  | { referee_id: number }
  | { user_name: string }
  | { first_name: string; last_name: string; email: string };

/** Teilnehmende aus Sicht der Kursleitung, ohne Kontakt- und Rechnungsdaten. */
export interface CourseLeadRegistration {
  id: number;
  vorname: string;
  nachname: string;
  age_at_course: number | null;
  club: { id: number; name: string } | null;
  lizenznummer: number | null;
  desired_license_level_id: number | null;
  status: RefereeCourseRegistrationStatus;
  result: 'passed' | 'failed' | null;
  test_version: string | null;
  points: number | null;
  custom_answers: Record<string, unknown>;
}

export interface CourseLeadCourse extends RefereeCourseSummary {
  sessions: RefereeCourseSession[];
  online_platform: string | null;
  description: string | null;
  editable: boolean;
  fields: RefereeCourseField[];
  registrations: CourseLeadRegistration[];
}

export interface RefereeCourseSummary {
  id: number;
  title: string;
  course_type: RefereeCourseType;
  format: RefereeCourseFormat;
  status: RefereeCourseStatus;
  registration_mode: 'open' | 'none';
  state_association: { id: number; name: string } | null;
  partner_state_association_ids: number[];
  starts_on: string | null;
  ends_on: string | null;
  min_participants: number | null;
  max_participants: number | null;
  registration_deadline: string | null;
  public: boolean;
  license_level_ids: number[];
  taken_seats?: number;
  registration_counts?: Record<string, number>;
}

export interface RefereeCourse extends RefereeCourseSummary {
  hosting_club: { id: number; name: string } | null;
  prerequisite_course: { id: number; title: string } | null;
  prerequisites_note: string | null;
  sessions: RefereeCourseSession[];
  online_platform: string | null;
  registration_opens_at: string | null;
  cancellation_deadline: string | null;
  min_age: number | null;
  fee_member_cents: number | null;
  fee_non_member_cents: number | null;
  fee_only_on_license: boolean;
  no_show_billable: boolean;
  bill_state_association: boolean;
  fee_note: string | null;
  contact_email: string | null;
  description: string | null;
  fields: RefereeCourseField[];
  leads: RefereeCourseLeadEntry[];
  free_seats: number | null;
  /** Nur bei Status `held`: was dem Einreichen noch im Weg steht. */
  submission_problems?: string[];
}

/** Schreibbare Felder eines Kurses. */
export type RefereeCourseInput = Partial<
  Omit<
    RefereeCourse,
    | 'id'
    | 'state_association'
    | 'hosting_club'
    | 'prerequisite_course'
    | 'fields'
    | 'leads'
    | 'free_seats'
    | 'taken_seats'
    | 'registration_counts'
    | 'starts_on'
    | 'ends_on'
  >
> & {
  state_association_id?: number | null;
  hosting_club_id?: number | null;
  prerequisite_course_id?: number | null;
};

export interface RefereeCourseOptions {
  state_associations: { id: number; name: string }[];
  partner_state_associations: { id: number; name: string }[];
  national_allowed: boolean;
  license_levels: { id: number; name: string }[];
  course_types: RefereeCourseType[];
}

export type RefereeCourseRegistrationStatus =
  | 'pending_email'
  | 'pending_guardian'
  | 'registered'
  | 'waitlisted'
  | 'cancelled_by_participant'
  | 'cancelled_by_organizer'
  | 'attended'
  | 'no_show';

export interface RefereeCourseRegistration {
  id: number;
  referee_id: number | null;
  lizenznummer: number | null;
  current_license_level: string | null;
  user_id: number | null;
  vorname: string;
  nachname: string;
  geburtsdatum: string;
  age_at_course: number | null;
  email: string | null;
  telefon: string | null;
  club: { id: number; name: string } | null;
  billing_club: { id: number; name: string } | null;
  billing_address: string | null;
  remarks: string | null;
  desired_license_level_id: number | null;
  awarded_license_level_id: number | null;
  stated_lizenznummer: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_confirmed_at: string | null;
  status: RefereeCourseRegistrationStatus;
  cancelled_at: string | null;
  late_cancellation: boolean;
  result: 'passed' | 'failed' | null;
  test_version: string | null;
  points: number | null;
  identity_match:
    | 'account'
    | 'confirmed_existing'
    | 'new_person'
    | 'needs_review';
  match_candidates: RefereeMatchCandidate[];
  custom_answers: Record<string, unknown>;
  fee_cents: number | null;
  source: 'admin' | 'portal' | 'club' | 'public';
  license: RegistrationLicenseState | null;
  created_at: string;
}

/** Möglicher Bestandsschiri zu einer Anmeldung (RefereeIdentityMatcher). */
export interface RefereeMatchCandidate {
  id: number;
  lizenznummer: number | null;
  vorname: string;
  nachname: string;
  geburtsdatum: string | null;
  club: string | null;
  lizenzstufe: string | null;
}

export type RefereeCourseRegistrationInput = Partial<
  Pick<
    RefereeCourseRegistration,
    | 'vorname'
    | 'nachname'
    | 'geburtsdatum'
    | 'email'
    | 'telefon'
    | 'billing_address'
    | 'remarks'
    | 'desired_license_level_id'
    | 'awarded_license_level_id'
    | 'stated_lizenznummer'
    | 'status'
    | 'result'
    | 'test_version'
    | 'points'
    | 'custom_answers'
  >
> & {
  referee_id?: number;
  club_id?: number | null;
  billing_club_id?: number | null;
  over_capacity?: boolean;
  identity_match?: 'new_person';
};

/** Kursangebot für Anmeldende (Portal, Verein, öffentlich), ohne Online-Link. */
export interface RefereeCourseOffer {
  id: number;
  title: string;
  course_type: RefereeCourseType;
  format: RefereeCourseFormat;
  status: RefereeCourseStatus;
  registration_mode: 'open' | 'none';
  state_association: { id: number; name: string } | null;
  partner_state_association_ids: number[];
  hosting_club: { id: number; name: string } | null;
  starts_on: string | null;
  ends_on: string | null;
  sessions: RefereeCourseSession[];
  online_platform: string | null;
  min_participants: number | null;
  max_participants: number | null;
  free_seats: number | null;
  registration_opens_at: string | null;
  registration_deadline: string | null;
  cancellation_deadline: string | null;
  /** null: Anmeldung möglich, sonst der Grund in Klartext. */
  registration_closed_reason: string | null;
  min_age: number | null;
  fee_member_cents: number | null;
  fee_non_member_cents: number | null;
  fee_only_on_license: boolean;
  fee_note: string | null;
  prerequisites_note: string | null;
  contact_email: string | null;
  description: string | null;
  license_levels: { id: number; name: string }[];
  fields: RefereeCourseField[];
  /** Nur im Portal: eigene aktive Anmeldung zu diesem Kurs. */
  my_registration_id?: number | null;
}

/** Eigene Anmeldung bzw. Anmeldung des Vereins. */
export interface OwnCourseRegistration {
  id: number;
  referee_course_id: number;
  course_title: string;
  starts_on: string | null;
  vorname: string;
  nachname: string;
  geburtsdatum: string;
  club: { id: number; name: string } | null;
  referee_id: number | null;
  status: RefereeCourseRegistrationStatus;
  cancelled_at: string | null;
  late_cancellation: boolean;
  result: 'passed' | 'failed' | null;
  desired_license_level_id: number | null;
  remarks: string | null;
  custom_answers: Record<string, unknown>;
  fee_cents: number | null;
  source: 'admin' | 'portal' | 'club' | 'public';
  cancellable: boolean;
}

export interface CourseSignupAnswers {
  desired_license_level_id: number | null;
  remarks: string;
  custom_answers: Record<string, unknown>;
}

export interface PortalCoursesResponse {
  own_state_association_id: number | null;
  courses: RefereeCourseOffer[];
  registrations: OwnCourseRegistration[];
}

export interface ClubCoursesResponse {
  clubs: { id: number; name: string }[];
  courses: RefereeCourseOffer[];
  registrations: OwnCourseRegistration[];
}

export interface ClubCourseReferee {
  id: number;
  vorname: string;
  nachname: string;
  lizenznummer: number | null;
  lizenzstufe: string | null;
  club_id: number;
}

export interface GuardianConsentInfo {
  name: string;
  club: string | null;
  course: Pick<
    RefereeCourseOffer,
    | 'title'
    | 'course_type'
    | 'format'
    | 'sessions'
    | 'starts_on'
    | 'ends_on'
    | 'fee_member_cents'
    | 'fee_non_member_cents'
    | 'contact_email'
    | 'description'
  >;
}

export interface PublicCoursesResponse {
  enabled: boolean;
  consent_version?: string;
  state_associations: { id: number; name: string }[];
  courses: RefereeCourseOffer[];
}

export interface PublicClub {
  id: number;
  name: string;
  state_association_id: number | null;
}

/** Anmeldung ohne Konto (öffentliches Formular). */
export interface PublicCourseRegistrationInput extends CourseSignupAnswers {
  vorname: string;
  nachname: string;
  geburtsdatum: string;
  email: string;
  telefon?: string | null;
  club_id: number | null;
  billing_address?: string | null;
  lizenznummer?: string | null;
  guardian_name?: string | null;
  guardian_email?: string | null;
  consent: boolean;
}

/** Was die Links aus den Mails (bestätigen, abmelden) anzeigen. */
export interface PublicRegistrationLinkInfo {
  name: string;
  status: RefereeCourseRegistrationStatus;
  late?: boolean;
  course: Pick<
    RefereeCourseOffer,
    | 'id'
    | 'title'
    | 'course_type'
    | 'format'
    | 'sessions'
    | 'starts_on'
    | 'contact_email'
  >;
}

/** Stand der Lizenzvergabe durch FD je Anmeldung (nach dem Einreichen). */
export interface RegistrationLicenseState {
  status: 'pending_review' | 'applied' | 'rejected';
  lizenzstufe: string | null;
  gueltigkeit: string | null;
  rejection_reason: string | null;
}

/** Eine Zeile der Lizenzvergabe durch FD. */
export interface CourseLicensingRow {
  id: number;
  status: 'pending_review' | 'applied' | 'rejected';
  lizenzstufe: string | null;
  gueltigkeit: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  new_referee_created: boolean;
  course: {
    id: number;
    title: string;
    course_type: RefereeCourseType;
    ends_on: string | null;
    state_association: string | null;
    license_levels: string[];
  };
  person: {
    vorname: string;
    nachname: string;
    geburtsdatum: string | null;
    email: string | null;
    club: string | null;
  };
  referee: {
    id: number;
    lizenznummer: number | null;
    lizenzstufe: string | null;
    gueltigkeit: string | null;
    career_ended: boolean;
  } | null;
  registration: {
    id: number;
    identity_match: string;
    match_candidates: RefereeMatchCandidate[];
    desired_level: string | null;
    test_version: string | null;
    points: number | null;
    stated_lizenznummer: string | null;
    source: string;
  } | null;
  license_mail?: string;
  account?: string;
}

/** Rechnungsexport der Kurse: Vorschau und erzeugte Exporte. */
export interface CourseBillingPreview {
  headers: string[];
  rows: {
    registration_id: number;
    values: (string | number | null)[];
    warnings: string[];
  }[];
  row_count: number;
  total_cents: number;
  waiting_for_license: string[];
}

export interface CourseBillingExport {
  id: number;
  state_association: { id: number; name: string } | null;
  from_date: string | null;
  to_date: string | null;
  row_count: number;
  total_cents: number;
  created_at: string;
  created_by: string | null;
}

export interface CourseBillingQuery {
  /** Id oder 'national' für bundesweite Kurse. */
  state_association_id: number | 'national';
  from?: string | null;
  to?: string | null;
  include_billed?: boolean;
}
