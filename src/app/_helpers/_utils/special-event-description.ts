import { GameAdditionalFields } from '@floorball/types';

/**
 * Mindestlänge der Beschreibung eines besonderen Ereignisses.
 *
 * Dieselbe Zahl wie `Game::SPECIAL_EVENT_DESCRIPTION_MIN_LENGTH` in der API,
 * die den Abschluss des Spielberichts sonst ablehnt. Ein besonderes Ereignis
 * verlangt seit 11.11.2026 kein Berichtsformular mehr, es wird stattdessen im
 * Spielbericht selbst beschrieben.
 */
export const SPECIAL_EVENT_DESCRIPTION_MIN_LENGTH = 50;

/** Zeichen der Beschreibung, wie die API sie zählt: ohne Leerraum am Rand. */
export function specialEventDescriptionLength(
  text: string | null | undefined
): number {
  return (text ?? '').trim().length;
}

/** Ist ein besonderes Ereignis angehakt, aber nicht ausreichend beschrieben? */
export function specialEventDescriptionMissing(
  fields: GameAdditionalFields | null | undefined
): boolean {
  if (!fields?.special_event) return false;
  return (
    specialEventDescriptionLength(fields.special_event_string) <
    SPECIAL_EVENT_DESCRIPTION_MIN_LENGTH
  );
}
