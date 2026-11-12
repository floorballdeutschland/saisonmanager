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

/**
 * Zeichen der Beschreibung, wie die API sie zählt: ohne Leerraum am Rand und
 * in Unicode-Zeichen. `.length` zählte UTF-16-Einheiten, ein Emoji also
 * doppelt, und gäbe den Knopf frei, den die API dann mit 49 Zeichen ablehnt.
 */
export function specialEventDescriptionLength(
  text: string | null | undefined
): number {
  return [...(text ?? '').trim()].length;
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

/**
 * Die Ablehnung für Vereine, wie die API sie formuliert, oder null. Für die
 * Rückfrage und die Meldung in der Statusnavigation, die vor Checkliste und
 * Tablet-Frage abweist (MatchReportComponent#closeMatchRecord).
 */
export function specialEventDescriptionProblem(
  fields: GameAdditionalFields | null | undefined
): string | null {
  if (!specialEventDescriptionMissing(fields)) return null;
  const min = SPECIAL_EVENT_DESCRIPTION_MIN_LENGTH;
  const length = specialEventDescriptionLength(fields?.special_event_string);
  if (length === 0) {
    return (
      'Es ist ein besonderes Ereignis angehakt, aber noch nicht beschrieben. ' +
      `Beschreibe unter „Spiel nachbereiten“ bei „Sonstige Ereignisse“, was passiert ist (mindestens ${min} Zeichen).`
    );
  }
  return (
    `Die Beschreibung des besonderen Ereignisses ist mit ${length} Zeichen zu kurz, ` +
    `nötig sind mindestens ${min} (es fehlen noch ${min - length}). ` +
    'Ergänze sie unter „Spiel nachbereiten“ bei „Sonstige Ereignisse“.'
  );
}
