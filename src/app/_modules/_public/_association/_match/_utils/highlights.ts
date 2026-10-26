import { Highlights, PersonRef } from '@floorball/types';

/** Gibt es etwas abzuspielen? Ohne Video oder ohne Szene bleibt alles unsichtbar. */
export function hasPlayableHighlights(
  highlights: Highlights | null | undefined
): highlights is Highlights & { video_id: string } {
  return !!highlights?.video_id && (highlights.scenes?.length ?? 0) > 0;
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
