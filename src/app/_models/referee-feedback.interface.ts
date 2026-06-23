/**
 * Schiri-Feedback der Vereine.
 *
 * Team-seitig (TM/VM): Übersicht der feedback-pflichtigen Spiele inkl. Status
 * sowie das Absende-Format. Die abgebende Seite sieht bewusst nur den Status,
 * nicht die Inhalte.
 *
 * Admin-seitig (Schiri-Profil): aggregierte Auswertung und Einzelrückmeldungen
 * inkl. Moderationsstatus.
 */

/** Ein feedback-pflichtiges Spiel in der Team-Übersicht. */
export interface RefereeFeedbackGame {
  game_id: number;
  team_id: number;
  team_name: string;
  opponent_name?: string;
  home: boolean;
  game_number?: string;
  league?: string;
  date: string;
  start_time?: string;
  referees: string[];
  /** ISO-Zeitpunkt, ab dem das Feedback abgegeben werden darf (Anpfiff + 24 h). */
  fillable_from: string;
  done: boolean;
  submitted_at?: string | null;
}

/** Absende-Format für ein Feedback. */
export interface RefereeFeedbackSubmit {
  game_id: number;
  team_id: number;
  line_rating: number;
  line_comment?: string;
  communication_rating: number;
  communication_comment?: string;
  general_comment?: string;
}

/** Statusantwort nach dem Absenden bzw. für bereits abgegebene Feedbacks. */
export interface RefereeFeedbackStatus {
  game_id: number;
  team_id: number;
  done: boolean;
  submitted_at: string;
}

/** Aggregierte Kennzahlen am Schiri-Profil. */
export interface RefereeFeedbackSummary {
  count: number;
  avg_line_rating: number | null;
  avg_communication_rating: number | null;
}

/** Einzelnes Feedback in der Schiriverwaltung (Admin/FD-RSK/FD-Ansetzer). */
export interface RefereeProfileFeedback {
  id: number;
  game_id: number;
  game_number?: string;
  date?: string;
  league?: string;
  team_name?: string;
  referee_names?: string;
  line_rating: number;
  line_comment?: string;
  communication_rating: number;
  communication_comment?: string;
  general_comment?: string;
  status: 'visible' | 'hidden';
  created_at: string;
}

export interface RefereeFeedbackProfileResponse {
  summary: RefereeFeedbackSummary;
  feedbacks: RefereeProfileFeedback[];
}
