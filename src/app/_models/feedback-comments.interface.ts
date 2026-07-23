/**
 * Schiri-Feedback-Kommentare (Admin/FD-RSK).
 *
 * Auswertung der Freitext-Kommentare aus dem Schiri-Feedback der Vereine:
 * gefilterter Kommentar-Feed, manuelle Themen-Verschlagwortung sowie eine
 * Themen-Häufigkeitsauswertung (Ranking + Zeitreihe).
 */

/** Ein Thema aus dem frei pflegbaren Themen-Katalog. */
export interface FeedbackTheme {
  id: number;
  name: string;
  color?: string | null;
  position?: number | null;
  usage_count?: number;
}

/** Schlanke Themen-Variante, wie sie an einem Kommentar hängt. */
export interface FeedbackCommentTheme {
  id: number;
  name: string;
  color?: string | null;
}

/** Ein einzelner Feedback-Kommentar im Feed. */
export interface FeedbackComment {
  id: number;
  game_id: number;
  game_number?: string | null;
  date?: string | null;
  league?: string | null;
  team_name?: string | null;
  referee_names?: string | null;
  referee1_id?: number | null;
  referee2_id?: number | null;
  line_rating?: number | null;
  line_comment?: string | null;
  communication_rating?: number | null;
  communication_comment?: string | null;
  general_comment?: string | null;
  status?: string;
  created_at?: string;
  themes: FeedbackCommentTheme[];
}

/** Filter für Feed und Auswertung (alle optional). */
export interface FeedbackCommentsFilter {
  referee_id?: number | null;
  tag_id?: number | null;
  league_id?: number | null;
  season_id?: number | null;
  from?: string | null;
  to?: string | null;
  max_rating?: number | null;
  theme_id?: number | null;
}

/** Ein Themen-Eintrag im Ranking der Auswertung. */
export interface FeedbackThemeStatEntry {
  theme_id: number;
  name: string;
  color?: string | null;
  count: number;
  /** Nur gesetzt, wenn eine Top-Gruppe (Tag) gewählt ist – sonst null. */
  group_count: number | null;
}

/** Ein Monatspunkt der Zeitreihe: pro Thema die Trefferzahl. */
export interface FeedbackThemeTimeSeriesEntry {
  /** Format 'YYYY-MM'. */
  period: string;
  counts: { [themeId: number]: number };
}

/** Antwort des Auswertungs-Endpoints. */
export interface FeedbackThemeStats {
  filters: Record<string, unknown>;
  themes: FeedbackThemeStatEntry[];
  time_series: FeedbackThemeTimeSeriesEntry[];
}
