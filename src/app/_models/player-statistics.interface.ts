/**
 * Spielerdaten-Rangliste (`GET admin/player_statistics`, api#465).
 *
 * Gelesen wird das naechtliche Aggregat, nicht die Spiele selbst — deshalb
 * traegt die Antwort mit `as_of`, wie alt der Stand ist.
 */

/** Eine Zeile der Rangliste: eine Person, ueber alle Saisons summiert. */
export interface PlayerStatisticsEntry {
  player_id: number;
  first_name: string;
  last_name: string;
  deactivated_at: string | null;
  games: number;
  goals: number;
  assists: number;
  scorer_points: number;
  scorer_per_game: number;
  goals_per_game: number;
  assists_per_game: number;
  penalty_minutes: number;
  /** Saison-IDs, nicht Jahreszahlen — der Name steht in `filters.seasons`. */
  first_season_id: string | null;
  last_season_id: string | null;
  /**
   * Nur in der Verbandsansicht: In der Vereinsansicht ist der Verein fuer jede
   * Zeile derselbe und steht in `scope.club`.
   */
  home_club_id?: number | null;
  home_club?: string | null;
}

export interface PlayerStatisticsSeasonOption {
  id: string;
  name: string;
}

export interface PlayerStatisticsGameOperationOption {
  id: number;
  name: string;
  short_name: string;
}

export interface PlayerStatisticsLeagueClassOption {
  id: string;
  name: string;
}

export interface PlayerStatisticsLeagueOption {
  id: number;
  name: string;
  season_id: string;
  league_class_id: string;
}

export interface PlayerStatisticsNamedOption {
  id: number;
  name: string;
}

/**
 * Auswahlwerte, die im Bestand dieses Blicks wirklich vorkommen. Liga und
 * Mannschaft liefert die API nur in der Vereinsansicht, die Vereinsliste nur in
 * der Verbandsansicht.
 *
 * Kommt NUR mit der ersten Seite: Die Werte haengen am Blick und nicht an den
 * gesetzten Filtern, koennen sich beim Blaettern also nicht aendern.
 */
export interface PlayerStatisticsFilterOptions {
  seasons: PlayerStatisticsSeasonOption[];
  game_operations: PlayerStatisticsGameOperationOption[];
  league_classes: PlayerStatisticsLeagueClassOption[];
  leagues?: PlayerStatisticsLeagueOption[];
  teams?: PlayerStatisticsNamedOption[];
  clubs?: PlayerStatisticsNamedOption[];
}

export interface PlayerStatisticsScope {
  mode: 'club' | 'association';
  club?: PlayerStatisticsNamedOption;
  /** Verbandsansicht: bundesweiter Blick statt einer Vereinsmenge. */
  global?: boolean;
}

export interface PlayerStatisticsResponse {
  scope: PlayerStatisticsScope;
  /** Zeitpunkt des Aggregats; null, solange nichts gerechnet wurde. */
  as_of: string | null;
  total: number;
  page: number;
  per_page: number;
  players: PlayerStatisticsEntry[];
  filters?: PlayerStatisticsFilterOptions;
}

export type PlayerStatisticsSortKey =
  | 'games'
  | 'goals'
  | 'assists'
  | 'scorer_points'
  | 'scorer_per_game'
  | 'penalty_minutes'
  | 'name';

/** Alles optional: Ohne `club_id` antwortet die API im Verbandsmodus. */
export interface PlayerStatisticsQuery {
  club_id?: number | null;
  club_filter_id?: number | null;
  season_id?: string[];
  game_operation_id?: number | null;
  league_id?: number | null;
  league_class_id?: string | null;
  team_id?: number | null;
  gender?: string | null;
  min_games?: number;
  include_deactivated?: boolean;
  only_current_members?: boolean;
  q?: string;
  sort?: PlayerStatisticsSortKey;
  sort_dir?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}
