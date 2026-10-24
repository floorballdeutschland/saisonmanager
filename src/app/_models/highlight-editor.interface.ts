import { ShotTeam } from './game-shot.interface';

/**
 * Kalibrierung und Szenenauswahl eines Tablet-Spiels (api#838).
 *
 * Gelesen und geschrieben über den Mail-Link (`highlight_editor?token=…`) oder
 * als Admin bzw. SBK des Spielbetriebs (`games/:id/highlight_editor`), beide
 * mit derselben Antwort.
 *
 * Versatz: positiv heißt, das Bild liegt hinter der Halle. Die Stelle eines
 * Ereignisses im Video ist `anchor_second + offset_seconds`.
 */
export interface HighlightEditorScene {
  /** Kennung des Tablet-Eintrags, Schlüssel für die Auswahl. */
  client_uuid: string;
  /**
   * `unlinked`: Tor-Schuss ohne Tor im Bericht. Steht nur hier, nie in den
   * öffentlichen Highlights, und lässt sich nur zuordnen, nicht auswählen.
   */
  kind: 'goal' | 'mark' | 'unlinked';
  /** „1:0 Müller (Schmidt)“, „Vorgemerkte Szene“ oder „Tor-Schuss ohne Tor im Bericht“. */
  label: string;
  /** Das Tor des Berichts, an dem der Schuss hängt; `null` bei Marken und `unlinked`. */
  event_id?: number | null;
  team: ShotTeam | null;
  period: number;
  game_time: string;
  /** Sekunde des Antippens im Video OHNE Versatz, `null` ohne Streamstart. */
  anchor_second: number | null;
  /** Szene mit dem gespeicherten Versatz. */
  start: number;
  end: number;
  in_highlights: boolean;
}

/** Ein Tor des Spielberichts, Ziel einer Zuordnung (api#849). */
export interface HighlightEditorGoal {
  event_id: number;
  label: string;
  team: ShotTeam;
  period: number;
  time: string;
}

/** Was ein Tor-Schuss werden kann, der doch keiner war. */
export type HighlightEditorNoGoalResult = 'saved' | 'missed' | 'blocked';

export type HighlightEditorAssignment =
  | { client_uuid: string; event_id: number }
  | {
      client_uuid: string;
      event_id: null;
      result: HighlightEditorNoGoalResult;
    };

export interface HighlightEditorData {
  game: {
    id: number;
    game_number: string | null;
    home_team_name: string;
    guest_team_name: string;
  };
  /** `null`: keine öffentlich verlinkte Aufzeichnung. */
  video_id: string | null;
  /** `null`: nicht kalibriert. */
  offset_seconds: number | null;
  calibrated_at: string | null;
  /** Das erste Tor mit Tablet-Schuss, `null` ohne Tor. */
  calibration_scene: { client_uuid: string; anchor_second: number } | null;
  scenes: HighlightEditorScene[];
  /** Alle Tore des Berichts; fehlt bei einer API vor api#849. */
  goals?: HighlightEditorGoal[];
  /** Nur beim Mail-Link. */
  expires_at?: string;
}

export interface HighlightEditorUpdate {
  /** Fehlt der Schlüssel, bleibt der Versatz; `null` nimmt ihn zurück. */
  offset_seconds?: number | null;
  scenes?: { client_uuid: string; in_highlights: boolean }[];
  /** Tor-Schüsse umhängen oder zum Fehlschuss machen. */
  assignments?: HighlightEditorAssignment[];
}
