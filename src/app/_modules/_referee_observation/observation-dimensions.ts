import { RefereeObservation, RefereeObservationRating } from '@floorball/types';

/**
 * Die fünf Bewertungsdimensionen des Beobachtungsbogens in der Reihenfolge des
 * Formulars. Eine Liste statt fünf mal Copy-Paste in Formular, Detailansicht und
 * Verwaltung: Die Dimensionen unterscheiden sich nur im Namen ihrer Felder.
 */
export interface ObservationDimensionDefinition {
  /** Schlüssel für die i18n-Beschriftung (`refereeObservation.dimension.<key>`). */
  key: string;
  ratingKey: keyof Pick<
    RefereeObservationRating,
    | 'stick_play_rating'
    | 'physical_play_rating'
    | 'penalty_line_rating'
    | 'game_management_rating'
    | 'overall_rating'
  >;
  pairKey: keyof Pick<
    RefereeObservation,
    | 'pair_stick_play_rating'
    | 'pair_physical_play_rating'
    | 'pair_penalty_line_rating'
    | 'pair_game_management_rating'
    | 'pair_overall_rating'
  >;
  /**
   * Zugehöriges Kommentarfeld. Die Gesamtspielbewertung (Frage 20) hat als
   * einzige keines – das Formular fasst dort in „Abschließende Bemerkungen"
   * zusammen.
   */
  commentKey: keyof Pick<
    RefereeObservation,
    | 'stick_play_comment'
    | 'physical_play_comment'
    | 'penalty_line_comment'
    | 'game_management_comment'
  > | null;
}

export const OBSERVATION_DIMENSIONS: ObservationDimensionDefinition[] = [
  {
    key: 'stickPlay',
    ratingKey: 'stick_play_rating',
    pairKey: 'pair_stick_play_rating',
    commentKey: 'stick_play_comment',
  },
  {
    key: 'physicalPlay',
    ratingKey: 'physical_play_rating',
    pairKey: 'pair_physical_play_rating',
    commentKey: 'physical_play_comment',
  },
  {
    key: 'penaltyLine',
    ratingKey: 'penalty_line_rating',
    pairKey: 'pair_penalty_line_rating',
    commentKey: 'penalty_line_comment',
  },
  {
    key: 'gameManagement',
    ratingKey: 'game_management_rating',
    pairKey: 'pair_game_management_rating',
    commentKey: 'game_management_comment',
  },
  {
    key: 'overall',
    ratingKey: 'overall_rating',
    pairKey: 'pair_overall_rating',
    commentKey: null,
  },
];

/** Skala des Bogens: 1 (POOR) bis 7 (EXCELLENT). */
export const OBSERVATION_RATING_SCALE = [1, 2, 3, 4, 5, 6, 7];
