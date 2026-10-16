// Schüsse aus dem Tabletmodus der Spielberichtseingabe (fe#344, api#816).
//
// Positionen sind auf die Angriffsrichtung des schießenden Teams normiert:
// x = 0 eigene Torlinie, x = 1 gegnerische Torlinie; y = 0 links, y = 1
// rechts aus Sicht des Angreifers. Damit liegen die Schüsse aller Abschnitte
// trotz Seitenwechsel auf derselben Grafik.

export type ShotTeam = 'home' | 'guest';

export type ShotResult = 'goal' | 'saved' | 'missed' | 'blocked';

export interface ShotInput {
  client_uuid: string;
  team: ShotTeam;
  period: number;
  // 'm:ss', leer, solange niemand die Spielzeit eingetragen hat.
  game_time: string;
  // Zeitpunkt des ersten Antippens in Serverzeit (ISO 8601 mit Millisekunden),
  // nicht der des Speicherns. Einzige Quelle für den genauen Torzeitpunkt.
  tapped_at: string;
  x: number;
  y: number;
  result: ShotResult;
  shooter_player_id?: number | null;
  goalkeeper_player_id?: number | null;
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
