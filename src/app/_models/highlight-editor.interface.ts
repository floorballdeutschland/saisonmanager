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
  kind: 'goal' | 'mark';
  /** „1:0 Müller (Schmidt)“ oder „Vorgemerkte Szene“. */
  label: string;
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
  /** Nur beim Mail-Link. */
  expires_at?: string;
}

export interface HighlightEditorUpdate {
  /** Fehlt der Schlüssel, bleibt der Versatz; `null` nimmt ihn zurück. */
  offset_seconds?: number | null;
  scenes?: { client_uuid: string; in_highlights: boolean }[];
}
