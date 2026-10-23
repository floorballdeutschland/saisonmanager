// Schüsse aus dem Tabletmodus der Spielberichtseingabe (fe#344, api#816).
//
// Positionen sind auf die Angriffsrichtung des schießenden Teams normiert.
// Beide Achsen laufen von Bande zu Bande über das ganze Feld, beim Großfeld
// 40 x 20 m, beim Kleinfeld 28 x 16 m (`league.field_size`, fe#591):
// x = 0 Bande hinter dem eigenen Tor, x = 1 Bande hinter dem gegnerischen
// Tor; y = 0 linke, y = 1 rechte Seitenbande aus Sicht des Angreifers.
// Damit liegen die Schüsse aller Abschnitte trotz Seitenwechsel auf
// derselben Grafik.

export type ShotTeam = 'home' | 'guest';

export type ShotResult = 'goal' | 'saved' | 'missed' | 'blocked';

// Ein Eintrag ist ein Schuss oder ein Freischlag (fe#589, api#837). Fehlt
// `kind`, ist es ein Schuss. Freischläge zählen nur für die Statistik und
// gehen weder in Highlights noch in Sprungmarken ein.
export type ShotKind = 'shot' | 'free_hit';

export interface ShotInput {
  client_uuid: string;
  kind?: ShotKind;
  // Bei einem Freischlag das ausführende (gefoulte) Team.
  team: ShotTeam;
  period: number;
  // 'm:ss', leer, solange niemand die Spielzeit eingetragen hat.
  game_time: string;
  // Zeitpunkt des ersten Antippens in Serverzeit (ISO 8601 mit Millisekunden),
  // nicht der des Speicherns. Einzige Quelle für den genauen Torzeitpunkt.
  tapped_at: string;
  x: number;
  y: number;
  // `null` bei einem Freischlag, sonst Pflicht.
  result: ShotResult | null;
  shooter_player_id?: number | null;
  goalkeeper_player_id?: number | null;
  // Schuss aus einem Freischlag heraus; bei Freischlägen immer `false`.
  from_free_hit?: boolean;
}

export interface Shot extends ShotInput {
  id: number;
  // id in games.events, gesetzt bei einem mit dem offiziellen Tor verknüpften
  // Schuss.
  event_id: number | null;
}

export interface ShotsResponse {
  shots: Shot[];
}

export interface ServerTimeResponse {
  now: string;
}

/** Rückmeldung zur Beta des Tabletmodus (fe#560), geht per Mail an die Administration. */
export interface TabletFeedbackInput {
  message: string;
  reply_to: string | null;
  device: string;
}
