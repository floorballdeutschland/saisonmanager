/**
 * Die Spiele, für die Livestreams eingerichtet werden.
 *
 * Was hier steht, kommt aus `GET admin/streaming/games`. Der Abruf setzt auf
 * `Game#meta_hash` auf -- deshalb tragen die Wappenfelder dieselben Namen wie
 * beim Thumbnail-Stapel und lassen sich ohne Umbau weiterreichen.
 */
export interface StreamingGameDay {
  id: number;
  number: number;
  /** `YYYY-MM-DD`. */
  date: string;
  league_id: number;
  hosting_club: string | null;
  arena: { name: string | null; city: string | null } | null;
}

export interface StreamingLeague {
  id: number;
  name: string;
  short_name: string | null;
  /** Name der YouTube-Playlist, leer = keine. */
  stream_playlist: string | null;
}

/**
 * Eine bereits angelegte Übertragung.
 *
 * Ihr Vorhandensein ist der Schutz gegen ein zweites Anlegen -- und der muss
 * hier sitzen, in der Liste: Wenn der Server gefragt wird, ist das
 * YouTube-Kontingent schon ausgegeben.
 */
export interface StreamingBroadcast {
  broadcast_id: string;
  watch_url: string;
  created_at: string;
  ended_at: string | null;
  ended_reason: string | null;
}

export interface StreamingGame {
  id: number;
  game_number: string | null;
  start_time: string;
  /** Anwurf als ISO-Zeitpunkt in Europe/Berlin, oder null ohne gepflegte Zeit. */
  start_at: string | null;
  home_team_name: string;
  guest_team_name: string;
  home_team_logo?: string | null;
  home_team_small_logo?: string | null;
  guest_team_logo?: string | null;
  guest_team_small_logo?: string | null;
  /** Öffentliche Spielseite; vom Server gebaut (Game#url), nicht hier. */
  public_url: string | null;
  live_stream_link: string | null;
  vod_link: string | null;
  /** Streamschlüssel des AUSRICHTERS, nicht der Heimmannschaft. */
  stream_key: string | null;
  streamable: boolean;
  game_day: StreamingGameDay | null;
  league: StreamingLeague | null;
  broadcast: StreamingBroadcast | null;
}

/** Zuschnitt der Liste: ein Zeitraum oder ein Spieltag einer Liga. */
export type StreamingFilter =
  | { from: string; to: string }
  | { leagueId: number; gameDayNumber: number };

export interface StreamingBroadcastInput {
  broadcast_id: string;
  privacy_status: string;
  title?: string;
  stream_id?: string;
}

/**
 * Titel- und Beschreibungsvorlage samt der jeweiligen Vorgabe.
 *
 * Die Vorgaben kommen mit, damit die Maske ein „zurücksetzen" anbieten kann,
 * ohne den Text ein zweites Mal zu kennen.
 */
export interface StreamingTemplates {
  title: string;
  description: string;
  default_title: string;
  default_description: string;
}
