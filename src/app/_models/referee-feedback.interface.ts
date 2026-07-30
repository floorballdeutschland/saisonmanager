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
  /**
   * ISO-Zeitpunkt, ab dem das Feedback abgegeben werden darf: das spätere von
   * Spielbericht-Abschluss und Anpfiff + 24 Stunden. Ein Ende gibt es bewusst
   * nicht, die erwarteten 24 Stunden für die Abgabe sind nur ein Hinweis im Text
   * und in der Benachrichtigungsmail.
   *
   * null, wenn die API keinen Zeitpunkt ermitteln kann (Altspiel ohne
   * gepflegtes Datum). Dann gilt allein der abgeschlossene Bericht, das Spiel ist
   * also ausfüllbar.
   */
  fillable_from: string | null;
  done: boolean;
  submitted_at?: string | null;
  /**
   * Adresse, an die die Einladung zur Abgabe gegangen ist (Kapitän*in oder
   * hinterlegter Feedback-Kontakt). Macht für den Teammanager sichtbar, ob er
   * selbst nachfassen muss.
   */
  invited_email?: string | null;
  invited_at?: string | null;
}

/** Die eigentlichen Antworten, unabhängig vom Abgabeweg. */
export interface RefereeFeedbackAnswers {
  line_rating: number;
  line_comment?: string;
  communication_rating: number;
  communication_comment?: string;
  general_comment?: string;
}

/** Absende-Format für ein Feedback (angemeldet, TM/VM). */
export interface RefereeFeedbackSubmit extends RefereeFeedbackAnswers {
  game_id: number;
  team_id: number;
}

/**
 * Einstellung je Mannschaft, wer das Feedback abgibt. Hängt an der Mannschaft
 * und nicht am Konto: Mehrere Teammanager sehen und ändern denselben Eintrag.
 */
export interface RefereeFeedbackTeamSettings {
  team_id: number;
  team_name: string;
  feedback_contact_email?: string | null;
  feedback_contact_prefer_captain: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
}

/** Zustand eines Einmal-Links zur Abgabe ohne Anmeldung. */
export type RefereeFeedbackInvitationStatus =
  | 'open'
  | 'submitted'
  | 'expired'
  | 'disabled';

/**
 * Kopfdaten der einen Begegnung, für die ein Einmal-Link gilt. Bewusst ohne die
 * Inhalte eines bereits abgegebenen Feedbacks.
 */
export interface RefereeFeedbackInvitation {
  status: RefereeFeedbackInvitationStatus;
  team_name: string;
  opponent_name?: string;
  home: boolean;
  game_number?: string;
  league?: string;
  date?: string;
  start_time?: string;
  referees: string[];
  expires_at?: string | null;
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
  submitted_via?: RefereeFeedbackOrigin | null;
  created_at: string;
}

/**
 * Abgabeweg einer Rückmeldung: aus einem angemeldeten Konto (Team- oder
 * Vereinsmanager) oder über einen Einmal-Link ohne Konto (Spielführung bzw. der
 * hinterlegte Feedback-Kontakt). null für Altbestand, dessen Weg nicht bekannt
 * ist. Name und Adresse der abgebenden Person liefert die API bewusst nicht.
 */
export type RefereeFeedbackOrigin = 'account' | 'invitation';

export interface RefereeFeedbackProfileResponse {
  summary: RefereeFeedbackSummary;
  feedbacks: RefereeProfileFeedback[];
}
