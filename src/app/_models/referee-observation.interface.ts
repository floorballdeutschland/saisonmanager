/**
 * Beobachtungsbogen des Schiedsrichtercoaches (Ablösung des Microsoft-Formulars
 * „Referee Coaching Form / Beobachtungsformular").
 *
 * Fünf Bewertungsdimensionen mal drei Bewertete: Schiedsrichter 1,
 * Schiedsrichter 2 und das Gespann. Die Gespann-Bewertung steht am Bogen
 * (`pair_*`), die personenbezogenen Bewertungen in `ratings` – das Gespann ist
 * keine Person.
 */

/** Die fünf Dimensionen in der Reihenfolge des Formulars. */
export type RefereeObservationDimension =
  | 'stick_play'
  | 'physical_play'
  | 'penalty_line'
  | 'game_management'
  | 'overall';

/** Bewertung einer einzelnen Person des Gespanns. */
export interface RefereeObservationRating {
  referee_id: number;
  referee_name: string | null;
  /** 1 oder 2, Slot im Gespann. */
  position: number | null;
  stick_play_rating: number | null;
  physical_play_rating: number | null;
  penalty_line_rating: number | null;
  game_management_rating: number | null;
  overall_rating: number | null;
}

export interface RefereeObservation {
  id: number;
  game_id: number;
  game_number: string | null;
  date: string | null;
  home_team: string | null;
  guest_team: string | null;
  league: string | null;
  league_id: number | null;
  game_operation_slug: string | null;

  coach_id: number;
  coach_name: string | null;
  status: 'visible' | 'hidden';
  submitted_at: string | null;
  /** Der Coach war für dieses Spiel angesetzt (statt es selbst gewählt zu haben). */
  assigned_as_coach: boolean;

  match_description: string | null;
  stick_play_comment: string | null;
  physical_play_comment: string | null;
  penalty_line_comment: string | null;
  game_management_comment: string | null;
  other_matters: string | null;
  final_comments: string | null;

  pair_stick_play_rating: number | null;
  pair_physical_play_rating: number | null;
  pair_penalty_line_rating: number | null;
  pair_game_management_rating: number | null;
  pair_overall_rating: number | null;

  /**
   * In der eigenen Sicht der beobachteten Person nur die eigene Zeile; in der
   * Coach- und Verwaltungssicht das ganze Gespann.
   */
  ratings: RefereeObservationRating[];
}

/** Ein Schiedsrichter des Gespanns in der Spielauswahl. */
export interface RefereeObservationCandidateReferee {
  referee_id: number;
  name: string | null;
  position: number;
}

/** Spiel, zu dem ein Bogen abgegeben werden darf. */
export interface RefereeObservationCandidate {
  game_id: number;
  game_number: string | null;
  date: string | null;
  start_time: string | null;
  home_team: string | null;
  guest_team: string | null;
  league: string | null;
  league_id: number | null;
  /** Ligamodus, Ligaklasse und Altersklasse – ersetzt die Formularfrage „Spielniveau". */
  league_level: string | null;
  game_operation_slug: string | null;
  assigned_as_coach: boolean;
  referees: RefereeObservationCandidateReferee[];
  done: boolean;
  observation_id: number | null;
}

/** Was der Bogen beim Absenden schickt. */
export interface RefereeObservationAnswers {
  game_id: number;
  match_description: string;
  stick_play_comment: string;
  physical_play_comment: string;
  penalty_line_comment: string;
  game_management_comment: string;
  other_matters: string;
  final_comments: string;
  pair_stick_play_rating: number;
  pair_physical_play_rating: number;
  pair_penalty_line_rating: number;
  pair_game_management_rating: number;
  pair_overall_rating: number;
  ratings: {
    referee_id: number;
    stick_play_rating: number;
    physical_play_rating: number;
    penalty_line_rating: number;
    game_management_rating: number;
    overall_rating: number;
  }[];
}

/** Antwort der Verwaltungssicht am Schiedsrichterprofil. */
export interface RefereeObservationAdminResponse {
  summary: {
    count: number;
    stick_play_rating: number | null;
    physical_play_rating: number | null;
    penalty_line_rating: number | null;
    game_management_rating: number | null;
    overall_rating: number | null;
  };
  observations: RefereeObservation[];
}
