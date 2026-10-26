import { PersonRef } from './detailed-stats.interface';
import { ShotTeam } from './game-shot.interface';

/**
 * Eine Szene in der Stream-Aufzeichnung (fe#555). `start` und `end` sind
 * Sekunden im Video, berechnet in der API aus dem Zeitpunkt des Antippens am
 * Tablet (unkalibriert 15 s davor bis 5 s danach, kalibriert 12 s davor bis
 * 8 s danach, api#838).
 *
 * `kind` 'goal' ist ein Tor mit verknüpftem Schuss, 'mark' eine am Tablet
 * vorgemerkte Szene ohne Tor (dann ohne Spielstand und Personen). Fehlt
 * `kind` (ältere API), ist es ein Tor.
 */
export interface HighlightScene {
  kind?: 'goal' | 'mark';
  event_id: number | null;
  start: number;
  end: number;
  team: ShotTeam | null;
  /** Spielstand nach dem Tor. */
  home_goals?: number;
  guest_goals?: number;
  period: number;
  game_time: string;
  scorer?: PersonRef | null;
  assist?: PersonRef | null;
}

/** `GET games/:id/highlights.json`, nur für Tablet-Spiele (sonst 404). */
export interface Highlights {
  /** `null`: kein Stream oder dessen Start unbekannt. */
  video_id: string | null;
  /**
   * Ist die Aufzeichnung kalibriert? Unkalibriert liegen die Szenen nur
   * ungefähr. `null` ohne Übertragung, fehlt bei älterer API.
   */
  calibrated?: boolean | null;
  scenes: HighlightScene[];
}
