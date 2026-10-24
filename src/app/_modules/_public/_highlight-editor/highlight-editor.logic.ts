import {
  HighlightEditorAssignment,
  HighlightEditorData,
  HighlightEditorNoGoalResult,
  HighlightEditorScene,
  HighlightEditorUpdate,
} from '@floorball/types';

/**
 * Rechnungen der Kalibrierung (api#838), in der API gespiegelt in
 * StreamTimeline. Die Seite rechnet selbst, damit eine Szene schon mit dem
 * noch nicht gespeicherten Versatz abgespielt werden kann.
 *
 * Versatz: positiv heißt, das Bild liegt hinter der Halle. Die Stelle eines
 * Ereignisses im Video ist `anchor_second + offset`.
 */

/** Erlaubter Bereich der API (`StreamBroadcast::OFFSET_RANGE`). */
export const OFFSET_MIN = -120;
export const OFFSET_MAX = 120;

/** Szenen ohne Kalibrierung: 15 s vor dem Antippen bis 5 s danach. */
export const SCENE_LEAD = 15;
export const SCENE_TAIL = 5;
/** Mit Kalibrierung 20 s um die verschobene Stelle. */
export const CALIBRATED_SCENE_LEAD = 12;
export const CALIBRATED_SCENE_TAIL = 8;

/**
 * Vorlauf der Kalibrierszene. Ohne Versatz liegt das Tor im Video 10 bis 30 s
 * NACH dem Antippen; 10 s davor reicht also, und das Tor kommt spätestens
 * nach rund 40 s.
 */
export const CALIBRATION_LEAD_UNCALIBRATED = 10;
/** Mit Versatz liegt das Tor ungefähr an seiner Stelle: 20 s Anlauf. */
export const CALIBRATION_LEAD_CALIBRATED = 20;

export function clampOffset(offset: number): number {
  return Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, Math.round(offset)));
}

/**
 * Versatz aus der Abspielposition, an der jemand „Jetzt fällt das Tor“
 * gedrückt hat.
 */
export function measureOffset(
  currentTime: number,
  anchorSecond: number
): number {
  return clampOffset(currentTime - anchorSecond);
}

/** Start der Kalibrierszene im Video. */
export function calibrationStart(
  anchorSecond: number,
  offset: number | null
): number {
  const start =
    offset === null
      ? anchorSecond - CALIBRATION_LEAD_UNCALIBRATED
      : anchorSecond + offset - CALIBRATION_LEAD_CALIBRATED;
  return Math.max(0, start);
}

/**
 * Fenster einer Szene mit dem angegebenen Versatz. Ohne Anker (Streamstart
 * unbekannt) bleibt es bei dem, was die API mit dem gespeicherten Versatz
 * gerechnet hat.
 */
export function sceneWindow(
  scene: Pick<HighlightEditorScene, 'anchor_second' | 'start' | 'end'>,
  offset: number | null
): { start: number; end: number } {
  if (scene.anchor_second === null) {
    return { start: scene.start, end: scene.end };
  }
  const [lead, tail] =
    offset === null
      ? [SCENE_LEAD, SCENE_TAIL]
      : [CALIBRATED_SCENE_LEAD, CALIBRATED_SCENE_TAIL];
  const at = scene.anchor_second + (offset ?? 0);
  return { start: Math.max(0, at - lead), end: Math.max(0, at + tail) };
}

/**
 * Was sich gegenüber dem geladenen Stand geändert hat. Der Versatz geht nur
 * mit, wenn er sich geändert hat: Jedes Schreiben setzt `calibrated_at` neu
 * und lässt den Wächter die Sprungmarken neu rechnen.
 */
export function buildUpdate(
  loaded: HighlightEditorData,
  offset: number | null,
  selection: Record<string, boolean>,
  assignment: Record<string, string> = {}
): HighlightEditorUpdate {
  const update: HighlightEditorUpdate = {};
  if (offset !== loaded.offset_seconds) update.offset_seconds = offset;
  const scenes = loaded.scenes
    .filter(
      (scene) =>
        isSelectable(scene) &&
        scene.client_uuid in selection &&
        selection[scene.client_uuid] !== scene.in_highlights
    )
    .map((scene) => ({
      client_uuid: scene.client_uuid,
      in_highlights: selection[scene.client_uuid],
    }));
  if (scenes.length > 0) update.scenes = scenes;
  const assignments = loaded.scenes.flatMap((scene) => {
    const value = assignment[scene.client_uuid];
    if (!value || value === initialAssignment(scene)) return [];
    const parsed = parseAssignment(scene.client_uuid, value);
    return parsed ? [parsed] : [];
  });
  if (assignments.length > 0) update.assignments = assignments;
  return update;
}

export function hasChanges(update: HighlightEditorUpdate): boolean {
  return (
    'offset_seconds' in update ||
    (update.scenes?.length ?? 0) > 0 ||
    (update.assignments?.length ?? 0) > 0
  );
}

/** Nur Tore und Marken kommen in die Highlights; ein Schuss ohne Tor nie. */
export function isSelectable(scene: HighlightEditorScene): boolean {
  return scene.kind !== 'unlinked';
}

/** Tore und Tor-Schüsse ohne Tor lassen sich einem Tor zuordnen. */
export function isAssignable(scene: HighlightEditorScene): boolean {
  return scene.kind === 'goal' || scene.kind === 'unlinked';
}

export const NO_GOAL_RESULTS: HighlightEditorNoGoalResult[] = [
  'saved',
  'missed',
  'blocked',
];

/**
 * Wert des Auswahlfelds „Gehört zu“: `goal:<event_id>`, `none:<result>` oder
 * leer, solange ein Schuss an keinem Tor hängt.
 */
export function initialAssignment(scene: HighlightEditorScene): string {
  return scene.event_id ? `goal:${scene.event_id}` : '';
}

function parseAssignment(
  clientUuid: string,
  value: string
): HighlightEditorAssignment | null {
  const [kind, rest] = value.split(':');
  if (kind === 'goal' && /^\d+$/.test(rest)) {
    return { client_uuid: clientUuid, event_id: Number(rest) };
  }
  if (kind === 'none' && (NO_GOAL_RESULTS as string[]).includes(rest)) {
    return {
      client_uuid: clientUuid,
      event_id: null,
      result: rest as HighlightEditorNoGoalResult,
    };
  }
  return null;
}

/** Sekunden als m:ss bzw. h:mm:ss, wie YouTube die Stelle anzeigt. */
export function formatVideoTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
