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
  match_candidates: unknown[];
  custom_answers: Record<string, unknown>;
  fee_cents: number | null;
  created_at: string;
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
};
