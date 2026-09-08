import { RefereeCourseResult } from '@floorball/types';

/**
 * Hinweistext zur Herkunft eines Vereinstreffers — für die Importeurs- und die
 * Freigabe-Maske gemeinsam, damit die beiden nicht auseinanderlaufen.
 *
 * Ein exakter Treffer auf den Vereinsnamen (`name`) bekommt keinen Hinweis:
 * Dort steht in der Datei, was in der Datenbank steht. Alles andere ist eine
 * Schlussfolgerung des Systems und gehört benannt.
 *
 * Die Zuordnung ist erschöpfend über den Union-Typ: Kommt aus der API ein
 * weiterer Wert, bricht der Build hier und erzwingt eine Entscheidung, statt
 * die Maske stillschweigend schweigen zu lassen.
 */
const HINT_KEYS: Record<
  NonNullable<RefereeCourseResult['csv_club_match_type']>,
  string | null
> = {
  name: null,
  alias: 'refereeCourseAdmin.detail.clubMatchAlias',
  long_name: 'refereeCourseAdmin.detail.clubMatchLongName',
  normalized_name: 'refereeCourseAdmin.detail.clubMatchNormalized',
  normalized_long_name: 'refereeCourseAdmin.detail.clubMatchNormalized',
  // Die vier Ausgänge ohne Verein. `ambiguous` ist der einzige, der eine
  // Aufgabe benennt: Zwei Vereine tragen dieselbe Schreibweise, aufgelöst wird
  // das über die Namensliste. Die übrigen erklärt schon die rote Meldung
  // „nicht zugeordnet" bzw. das leere Feld.
  ambiguous: 'refereeCourseAdmin.detail.clubMatchAmbiguous',
  alias_target_missing: 'refereeCourseAdmin.detail.clubMatchAliasBroken',
  none: null,
  placeholder: null,
  blank: null,
};

/**
 * Hat der Vereinsname aus der Datei einen Verein getroffen? Maßgeblich ist
 * `csv_club_match` und nicht `matched_club`: Letzteres ist der Zielwert der
 * Zeile und fällt beim Import auf den Verein des Schiedsrichters zurück —
 * daran gemessen sah der häufigste Nicht-Treffer wie ein Treffer aus.
 *
 * `=== null` und nicht `!x`: Ein **fehlendes** Feld ist keine Aussage. Liefert
 * die API es (noch) nicht — Frontend-Deploy vor dem API-Deploy —, stünde sonst
 * in jeder Zeile mit Vereinsfeld die rote Meldung, auch bei exakten Treffern.
 */
export function csvClubUnmatched(result: RefereeCourseResult): boolean {
  return !!result.csv.verein && result.csv_club_match === null;
}

export function clubMatchHintKey(result: RefereeCourseResult): string | null {
  const matchType =
    result.csv_club_match?.match_type ?? result.csv_club_match_type;
  if (!matchType) return null;
  // Ein zur Laufzeit unbekannter Wert (neue API, altes Frontend) ist eher
  // „nicht wortgleich" als „exakt": lieber ein allgemeiner Hinweis als
  // Schweigen.
  return matchType in HINT_KEYS
    ? HINT_KEYS[matchType]
    : 'refereeCourseAdmin.detail.clubMatchOther';
}
