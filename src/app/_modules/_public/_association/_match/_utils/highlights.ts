import {
  DetailedStatsShot,
  HighlightScene,
  Highlights,
  PersonRef,
} from '@floorball/types';

/** Gibt es etwas abzuspielen? Ohne Video oder ohne Szene bleibt alles unsichtbar. */
export function hasPlayableHighlights(
  highlights: Highlights | null | undefined
): highlights is Highlights & { video_id: string } {
  return !!highlights?.video_id && (highlights.scenes?.length ?? 0) > 0;
}

/**
 * Die Szene zu einem Punkt der Schussgrafik, `-1` wenn es keine gibt.
 *
 * Zugeordnet wird allein über `event_id`, das offizielle Tor, mit dem die API
 * den Schuss verknüpft hat. Ein Tor-Schuss ohne Verknüpfung hat keine Szene.
 */
export function sceneIndexForShot(
  shot: DetailedStatsShot,
  scenes: HighlightScene[]
): number {
  if (shot.result !== 'goal' || shot.event_id === null) return -1;
  return scenes.findIndex((scene) => scene.event_id === shot.event_id);
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
