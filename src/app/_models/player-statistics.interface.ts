/**
 * Spielerdaten-Rangliste (`GET admin/player_statistics`, api#465).
 *
 * Gelesen wird das naechtliche Aggregat und nicht die Spiele selbst; `as_of`
 * benennt, wann die ausgelieferten Zeilen gerechnet wurden.
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
  /** Nullable: `League` validiert die Spielklasse mit `allow_blank: true`. */
  league_class_id: string | null;
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
 * Kommt NUR mit der ersten Seite. Die Werte haengen am Blick, und dazu gehoert
 * der Vereinsfilter der Verbandsansicht: Mit gesetztem `club_filter_id` sind
 * sie auf diesen einen Verein eingeengt. Siehe `_applyFilterOptions` in
 * `PlayerStatisticsComponent`, das sie deshalb nicht uebernimmt.
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
  /**
   * Juengster `computed_at` der Zeilen DIESER Seite. Null, wenn die Seite leer
   * ist -- das heisst „kein Treffer" oder „noch kein Rechenlauf", die Antwort
   * unterscheidet beides nicht.
   */
  as_of: string | null;
  total: number;
  page: number;
  per_page: number;
  players: PlayerStatisticsEntry[];
  filters?: PlayerStatisticsFilterOptions;
}

/** Die Werte, die die Maske anbietet; die API vergleicht sie kleingeschrieben. */
export type PlayerStatisticsGenderFilter = 'M' | 'W' | 'D';

/**
 * Fehlerkoerper des Endpunkts: `error` beim 503 (Aggregat nicht lesbar),
 * `message` bei 403 und 404. Zwei Schluessel, deshalb hier benannt.
 */
export interface PlayerStatisticsErrorBody {
  error?: string;
  message?: string;
}

export type PlayerStatisticsSortKey =
  | 'games'
  | 'goals'
  | 'assists'
  | 'scorer_points'
  | 'scorer_per_game'
  | 'penalty_minutes'
  | 'name';

/**
 * Alles optional: Ohne `club_id` antwortet die API im Verbandsmodus.
 *
 * `club_filter_id` gilt nur dort. Mit gesetztem `club_id` laesst die API ihn
 * fallen (und prueft die Rechte daran nicht), er darf dann also nicht mit.
 */
export interface PlayerStatisticsQuery {
  club_id?: number | null;
  club_filter_id?: number | null;
  season_id?: string[];
  game_operation_id?: number | null;
  league_id?: number | null;
  league_class_id?: string | null;
  team_id?: number | null;
  gender?: PlayerStatisticsGenderFilter | null;
  min_games?: number;
  include_deactivated?: boolean;
  only_current_members?: boolean;
  q?: string;
  sort?: PlayerStatisticsSortKey;
  sort_dir?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}
