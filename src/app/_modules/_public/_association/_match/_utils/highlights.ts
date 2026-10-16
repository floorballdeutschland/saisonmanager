import {
  DetailedStatsShot,
  HighlightScene,
  Highlights,
  PersonRef,
} from '@floorball/types';

/**
 * Höchster Abstand in Sekunden Spielzeit, bis zu dem ein Tor-Schuss ohne
 * `event_id` noch einer Szene desselben Teams und Abschnitts zugeordnet wird.
 * Die Szene trägt die Spielzeit des offiziellen Tores, der Schuss die des
 * Antippens; beide liegen nah beieinander, aber nicht zwingend gleich.
 */
export const SCENE_MATCH_TOLERANCE_S = 60;

/** Gibt es etwas abzuspielen? Ohne Video oder ohne Szene bleibt alles unsichtbar. */
export function hasPlayableHighlights(
  highlights: Highlights | null | undefined
): highlights is Highlights & { video_id: string } {
  return !!highlights?.video_id && (highlights.scenes?.length ?? 0) > 0;
}

/** „m:ss“ (auch „mm:ss“) in Sekunden, `null` bei unlesbarem Wert. */
export function parseGameTime(value: string | null | undefined): number | null {
  const match = /^\s*(\d+):(\d{1,2})\s*$/.exec(value ?? '');
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Die Szene zu einem Punkt der Schussgrafik, `-1` wenn es keine gibt.
 *
 * Nur Tore haben Szenen. Liefert die API die `event_id` des verknüpften Tores
 * mit, entscheidet allein sie. Sonst gilt die zeitlich nächste Szene desselben
 * Teams im selben Abschnitt, höchstens SCENE_MATCH_TOLERANCE_S entfernt.
 */
export function sceneIndexForShot(
  shot: DetailedStatsShot,
  scenes: HighlightScene[]
): number {
  if (shot.result !== 'goal') return -1;

  if (shot.event_id !== undefined && shot.event_id !== null) {
    return scenes.findIndex((scene) => scene.event_id === shot.event_id);
  }

  const shotTime = parseGameTime(shot.game_time);
  if (shotTime === null) return -1;

  let best = -1;
  let bestDistance = Infinity;
  scenes.forEach((scene, index) => {
    if (scene.team !== shot.team || scene.period !== shot.period) return;
    const sceneTime = parseGameTime(scene.game_time);
    if (sceneTime === null) return;
    const distance = Math.abs(sceneTime - shotTime);
    if (distance <= SCENE_MATCH_TOLERANCE_S && distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/** Die Szene nach `current`, `null` nach der letzten. */
export function nextSceneIndex(current: number, total: number): number | null {
  return current + 1 < total ? current + 1 : null;
}

export function personLabel(person: PersonRef | null | undefined): string {
  if (!person) return '';
  const number =
    person.trikot_number !== null && person.trikot_number !== undefined
      ? `#${person.trikot_number} `
      : '';
  return number + person.name;
}
