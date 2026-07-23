/**
 * Schiri-Feedback-Auswertung (Analytics-Dashboard).
 *
 * Aggregierte Auswertung der Vereins-Feedbacks über alle Schiedsrichter, mit
 * optionaler Vergleichs-„Top-Gruppe" (referee_tag), Verteilungen nach
 * Bewertungsband, Zeitreihe pro Monat und Einzel-Kennzahlen je Schiri.
 *
 * Backend: GET admin/referee_feedback_analytics (Gate `referee_feedback_view`).
 */

/** Aktuell angewandte Filter (Echo des Backends). */
export interface RefereeFeedbackReportFilters {
  season_id: string | null;
  league_id: number | null;
  tag_id: number | null;
  from: string | null;
  to: string | null;
  result: 'won' | 'lost' | null;
  min_count: number | null;
}

/** Verteilung nach Bewertungsband (1-2 … 9-10). */
export interface RefereeFeedbackDistributionBands {
  '1-2': number;
  '3-4': number;
  '5-6': number;
  '7-8': number;
  '9-10': number;
}

export interface RefereeFeedbackDistribution {
  line: RefereeFeedbackDistributionBands;
  communication: RefereeFeedbackDistributionBands;
}

/** Kennzahlen-Block (Gesamt oder Gruppe). */
export interface RefereeFeedbackReportOverall {
  count: number;
  avg_line_rating: number | null;
  avg_communication_rating: number | null;
  distribution: RefereeFeedbackDistribution;
}

/** Kennzahlen-Block der Top-Gruppe inkl. Tag-Metadaten. */
export interface RefereeFeedbackReportGroup extends RefereeFeedbackReportOverall {
  tag_id: number;
  tag_name: string;
}

/** Einzelner Schiedsrichter in der Tabelle. */
export interface RefereeFeedbackReportReferee {
  referee_id: number;
  referee_name: string;
  lizenznummer: number | null;
  in_group: boolean;
  count: number;
  /** false = zu wenig Datenpunkte (unter Mindest-Fallzahl), trotzdem gelistet. */
  ranked: boolean;
  avg_line_rating: number | null;
  avg_communication_rating: number | null;
  avg_line_rating_prev: number | null;
  avg_communication_rating_prev: number | null;
  trend_line: number | null;
  trend_communication: number | null;
  partners: string[];
}

/** Ein Datenpunkt der Zeitreihe (ein Monat). */
export interface RefereeFeedbackReportTimePoint {
  period: string; // 'YYYY-MM'
  count: number;
  avg_line_rating: number | null;
  avg_communication_rating: number | null;
}

export interface RefereeFeedbackReportTimeSeries {
  overall: RefereeFeedbackReportTimePoint[];
  group: RefereeFeedbackReportTimePoint[];
}

/** Gesamtantwort des Analytics-Endpunkts. */
export interface RefereeFeedbackReport {
  filters: RefereeFeedbackReportFilters;
  overall: RefereeFeedbackReportOverall;
  group: RefereeFeedbackReportGroup | null;
  referees: RefereeFeedbackReportReferee[];
  time_series: RefereeFeedbackReportTimeSeries;
}

/** Query-Parameter für Auswertung & Export. */
export interface RefereeFeedbackReportQuery {
  season_id?: string;
  league_id?: number;
  tag_id?: number;
  from?: string;
  to?: string;
  result?: 'won' | 'lost';
  min_count?: number;
}
