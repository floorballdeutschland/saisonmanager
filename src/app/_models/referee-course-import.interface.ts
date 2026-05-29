export type RefereeCourseImportStatus =
  | 'in_review'
  | 'submitted'
  | 'completed'
  | 'cancelled';

export type RefereeCourseResultStatus = 'pending_review' | 'applied';

export type RefereeCourseMatchType =
  | 'exact_match'
  | 'partial_match'
  | 'new_entry';

export interface RefereeCourseMasterFields {
  lizenznummer: number | null;
  vorname: string | null;
  nachname: string | null;
  geburtsdatum: string | null;
  club_id: number | null;
  email: string | null;
}

export interface RefereeCourseCsvFields {
  lizenznummer: number | null;
  vorname: string | null;
  nachname: string | null;
  geburtsdatum: string | null;
  verein: string | null;
  email: string | null;
}

export interface RefereeCourseImportProgress {
  total: number;
  pending_review: number;
  applied: number;
}

export interface RefereeCourseImport {
  id: number;
  filename: string;
  status: RefereeCourseImportStatus;
  total_rows: number;
  uploaded_by_user_id: number;
  created_at: string;
  progress?: RefereeCourseImportProgress;
}

export interface RefereeSnapshot {
  id: number;
  lizenznummer: number | null;
  vorname: string | null;
  nachname: string | null;
  geburtsdatum: string | null;
  email: string | null;
  club_id: number | null;
  lizenzstufe?: string | null;
  gueltigkeit?: string | null;
}

export interface MatchedClub {
  id: number;
  name: string;
  state_association_id: number | null;
}

export interface RefereeCourseResult {
  id: number;
  referee_course_import_id: number;
  referee_id: number | null;
  state_association_id: number | null;
  status: RefereeCourseResultStatus;
  match_type: RefereeCourseMatchType;
  match_field_count: number;
  lizenzstufe: string | null;
  gueltigkeit: string | null;
  kursstichtag: string | null;
  master: RefereeCourseMasterFields;
  master_by_importer: RefereeCourseMasterFields;
  csv: RefereeCourseCsvFields;
  lv_changes: Partial<
    Record<keyof RefereeCourseMasterFields, { from: unknown; to: unknown }>
  >;
  course_data: {
    kurs_1?: {
      stufe?: string;
      datum?: string;
      testversion?: string;
      punkte?: string;
    };
    kurs_2?: {
      stufe?: string;
      datum?: string;
      testversion?: string;
      punkte?: string;
    };
    ausbilder?: string;
  };
  new_referee_created: boolean;
  reviewed_by_user_id: number | null;
  reviewed_at: string | null;
  applied_at: string | null;
  referee_snapshot?: RefereeSnapshot | null;
  matched_club?: MatchedClub | null;
  age_at_kursstichtag?: number | null;
  previous_season_game_count?: number;
  state_association?: { id: number; name: string } | null;
}

export interface RefereeCourseImportWithResults extends RefereeCourseImport {
  results: RefereeCourseResult[];
}
