import { PersonRef, ShotTeam } from './detailed-stats.interface';

/**
 * Eine Torszene in der Stream-Aufzeichnung (fe#555). `start` und `end` sind
 * Sekunden im Video, berechnet in der API aus dem Zeitpunkt des verknüpften
 * Tablet-Schusses (15 s davor bis 5 s danach).
 */
export interface HighlightScene {
  event_id: number;
  start: number;
  end: number;
  team: ShotTeam;
  /** Spielstand nach dem Tor. */
  home_goals: number;
  guest_goals: number;
  period: number;
  game_time: string;
  scorer: PersonRef | null;
  assist: PersonRef | null;
}

/** `GET games/:id/highlights.json`, nur für Tablet-Spiele (sonst 404). */
export interface Highlights {
  /** `null`: kein Stream oder dessen Start unbekannt. */
  video_id: string | null;
  scenes: HighlightScene[];
}
