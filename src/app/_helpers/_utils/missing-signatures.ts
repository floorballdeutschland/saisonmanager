import { GameAdditionalFields } from '@floorball/types';

// Bezeichnungen wie an den Haken der Berichtsmaske (match-event-form).
const SIGNATURE_LABELS: Record<string, string> = {
  time_keeper_signed: 'Zeitnehmer/in',
  record_keeper_signed: 'Schriftführer/in',
  home_captain_signed: 'Heim',
  guest_captain_signed: 'Gast',
  referee1_signed: 'Schiedsrichter 1',
  referee2_signed: 'Schiedsrichter 2',
};

/**
 * Die Unterschriften, ohne die die API den Abschluss des Berichts ablehnt.
 *
 * Welche das sind, entscheidet die API (`missing_signatures`, dieselbe Regel
 * wie die Sperre in `GamesController#set_game_status`): Schiedsrichter 2 nur,
 * wenn er eingetragen ist, Forfait-Spiele gar nicht. Hier wird sie nicht
 * nachgebaut. Liefert eine ältere API das Feld nicht, gilt nichts als fehlend;
 * die Sperre bleibt dann allein die Antwort der API.
 */
export function missingSignatures(
  fields: GameAdditionalFields | null | undefined
): string[] {
  return fields?.missing_signatures ?? [];
}

export function missingSignatureLabels(
  fields: GameAdditionalFields | null | undefined
): string[] {
  return missingSignatures(fields).map(
    (field) => SIGNATURE_LABELS[field] ?? field
  );
}
