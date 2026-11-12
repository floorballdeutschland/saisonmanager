import { GameAdditionalFields } from '@floorball/types';

/**
 * Protest angehakt, aber keine Protestpartei gewählt? Dann lehnt die API den
 * Abschluss für den Verein ab (GamesController#_protest_parties_error), die SBK
 * wird nur gewarnt. Liefert eine ältere API die Auswahl nicht, sperrt die
 * Maske nichts.
 */
export function protestPartiesMissing(
  fields: GameAdditionalFields | null | undefined
): boolean {
  if (!fields?.protest || !fields.protest_party_options) return false;
  return (fields.protest_parties ?? []).length === 0;
}

export const PROTEST_PARTIES_MISSING_MESSAGE =
  'Es ist ein Protest angehakt, aber keine Protestpartei ausgewählt. Wähle ' +
  'unter „Sonstige Ereignisse“ aus, wer Protest eingelegt hat (bei einer ' +
  'Partei, die nicht aufgeführt ist, „Andere“).';
