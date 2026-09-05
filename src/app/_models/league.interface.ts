import { Team } from './team.interface';
import { LeagueQualification } from './league-qualification.interface';
import { CompetitionGroup } from './player.interface';

/**
 * Wettbewerbstyp einer Liga, wie ihn die API in `league_type` liefert (für
 * neue Ligen identisch mit `league_modus`, für Altligen aus
 * `league_category_id` abgeleitet).
 *
 * `playoff` ist der jüngste Wert (api#603): Playoffs und Playdowns sind
 * Ausscheidungswettbewerbe wie der Pokal, aber die Fortsetzung einer
 * bestehenden Liga und kein eigener Wettbewerb.
 */
export type LeagueType = 'league' | 'cup' | 'playoff' | 'champ';

export interface League {
  id: number;
  game_operation_id: number;
  game_operation_name: string;
  game_operation_short_name?: string;
  game_operation_slug?: string;
  league_category_id: string;
  league_class_id: string;
  league_system_id: string;
  name: string;
  female: boolean;
  age_group?: string;
  enable_scorer: boolean;
  short_name: string;
  season_id: string;
  order_key: string;
  league_type: LeagueType;

  legacy_league: boolean;
  field_size: string;
  league_modus: string;
  /**
   * Wettbewerbsgruppe (api#603): `liga` (Liga und Playoffs), `pokal`,
   * `meisterschaft`. Der Geltungsbereich einer Spielersperre steht darauf.
   */
  competition_group?: CompetitionGroup;
  league_id_preseason?: number;
  league_id_preround?: number;
  has_preround: boolean;
  preround_point_modus?: string;
  preround_scorer_modus?: string;
  league_id_direct_encounters?: number;

  deadline?: string;
  before_deadline?: boolean;
  parental_consent_required: boolean;
  referee_feedback_enabled?: boolean;

  table_modus: string;
  direct_comparison: boolean;
  periods: number;
  period_length: number;
  overtime_length: number;

  game_day_numbers: number[];
  game_day_titles: Array<{ game_day_number: number; title: string }>;
  similar_leagues?: League[];
  required_documents?: string[];
  qualifications?: LeagueQualification[];
  banner_url?: string | null;
  banner_link_url?: string | null;
  // Erkennungszeichen der Liga. `logo_source` sagt, woher es stammt: Bei
  // `state_association` hat die Liga kein eigenes und es steht das Logo des
  // Landesverbands da.
  logo_url?: string | null;
  logo_source?: 'league' | 'state_association' | null;
}

export interface LeagueWithTeams extends League {
  teams: Team[];
}
