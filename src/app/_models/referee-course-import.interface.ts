// Deckungsgleich mit RefereeCourseImport::STATUSES in der API. `completed`
// stand hier, ohne dass die API den Zustand je erzeugt.
//
// `partially_submitted`: Ein Teil ist eingereicht, der Importeur hat Zeilen
// zurückgestellt. Der Import bleibt bearbeitbar, bis sie geklärt (und
// nachgereicht) oder verworfen sind.
export type RefereeCourseImportStatus =
  | 'in_review'
  | 'partially_submitted'
  | 'submitted'
  | 'cancelled';

export type RefereeCourseResultStatus =
  | 'pending_review'
  | 'applied'
  | 'rejected';

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
  /** Offen — enthält beides: beim LV wartend und vom Importeur zurückgestellt. */
  pending_review: number;
  applied: number;
  rejected: number;
  /** Vom Importeur zurückgestellt, wartet auf eine Klärung. */
  deferred: number;
  /** Zeilen, die ein Einreichen jetzt anwenden würde. */
  submittable: number;
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
  // Nur die Freigabeübersicht liefert den Vereinsnamen mit.
  club_name?: string | null;
  lizenzstufe?: string | null;
  gueltigkeit?: string | null;
}

/**
 * Woran der Vereinsname aus der Datei gehangen hat. Die Reihenfolge der
 * Auflösung ist verbindlich (RefereeClubLookup in der API): Namensliste,
 * exakter Vereinsname, exakter Langname, dann beide ohne „e.V." und
 * Satzzeichen. Alles außer `name` ist eine Schlussfolgerung und keine
 * Gleichheit — die Masken sagen das.
 */
export type RefereeCourseClubMatchType =
  | 'alias'
  | 'name'
  | 'long_name'
  | 'normalized_name'
  | 'normalized_long_name';

export interface MatchedClub {
  id: number;
  name: string;
  state_association_id: number | null;
}

/**
 * Der Verein, den der Name aus der Datei trifft — mit der Herkunft des
 * Treffers. Eigener Typ und nicht ein optionales Feld an `MatchedClub`: An
 * `matched_club` (dem Zielwert der Zeile) liefert die API die Herkunft nie,
 * und `match_type` heißt am Ergebnis selbst etwas völlig anderes
 * (`exact_match` …).
 */
export interface CsvClubMatch extends MatchedClub {
  match_type?: RefereeCourseClubMatchType;
}

export interface RefereeCourseResult {
  id: number;
  referee_course_import_id: number;
  referee_id: number | null;
  state_association_id: number | null;
  status: RefereeCourseResultStatus;
  /** Vom Importeur zurückgestellt: Das Einreichen überspringt die Zeile. */
  deferred: boolean;
  /**
   * Gesetzt, sobald das Einreichen die Zeile angewendet hat. Ab dann gehört sie
   * dem Landesverband, der Importeur kann sie nicht mehr bearbeiten.
   */
  submitted_at: string | null;
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
  /**
   * Begründung des Landesverbands beim Zurückweisen — und beim Verwerfen durch
   * den Importeur der feste Vermerk, dass er es war.
   */
  rejection_reason?: string | null;
  referee_snapshot?: RefereeSnapshot | null;
  /**
   * Der Verein, den Import bzw. Freigabe als Zielwert führen
   * (`master_club_id_final`). Achtung: Trifft der Vereinsname aus der Datei
   * keinen Verein, fällt er auf den Verein des Schiedsrichters zurück. Für die
   * Frage „weicht der Verein ab?" ist deshalb `csv_club_match` maßgeblich.
   */
  matched_club?: MatchedClub | null;
  /**
   * Der Verein, den der Vereinsname aus der Datei trifft, oder `null` — samt
   * `match_type`. Maßgeblich für die Frage „trifft der Name überhaupt?":
   * `matched_club` fällt beim Import auf den Verein des Schiedsrichters zurück
   * und meldet damit ausgerechnet für den häufigsten Nicht-Treffer Gleichheit.
   */
  csv_club_match?: CsvClubMatch | null;
  /**
   * Die Herkunft auch ohne Treffer: `ambiguous` (zwei Vereine tragen dieselbe
   * Schreibweise — hier braucht es einen Eintrag in der Namensliste), `none`
   * (unbekannt), `placeholder` („Karriere beendet" und Ähnliches), `blank`.
   * Ohne diese Angabe sahen alle vier in der Maske gleich aus.
   */
  csv_club_match_type?: RefereeCourseClubMatchType | 'ambiguous' | 'none' | 'placeholder' | 'blank' | 'alias_target_missing' | null;
  age_at_kursstichtag?: number | null;
  previous_season_game_count?: number;
  state_association?: { id: number; name: string } | null;
}

export interface RefereeCourseImportWithResults extends RefereeCourseImport {
  results: RefereeCourseResult[];
}
