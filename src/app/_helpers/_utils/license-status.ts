/**
 * Anzeige des Lizenzstatus.
 *
 * Eine Stelle für die Farbgebung, weil derselbe Status in der Lizenzliste
 * einer Liga, in der Verbandsübersicht und in der Vereinsansicht steht. Vor
 * api#605 stand die Zuordnung als verschachtelte Bedingung in den Templates,
 * und der Status `gesperrt` fiel dort in den grauen Rest -- was ihn von
 * „zurückgezogen" nicht unterschied.
 */

import { PlayerLicenseHistory } from '@floorball/types';

/** Lizenz ist wegen einer Spielersperre ausgesetzt (License::SUSPENDED). */
export const LICENSE_STATUS_SUSPENDED = 9;

/** Lizenz ist erteilt (License::APPROVED). */
export const LICENSE_STATUS_APPROVED = 1;

/**
 * Farbklassen für das Statusabzeichen.
 *
 * `gesperrt` bekommt Rot wie die Ablehnung: Beides heißt, dass der Spieler
 * nicht spielberechtigt ist, und beides muss in einer langen Liste ins Auge
 * fallen.
 */
export function licenseStatusBadgeClass(statusId?: number | null): string {
  switch (Number(statusId)) {
    case LICENSE_STATUS_APPROVED:
      return 'bg-green-100 text-green-800';
    case 2:
      return 'bg-yellow-100 text-yellow-800';
    case 3:
      return 'bg-red-100 text-red-800';
    case LICENSE_STATUS_SUSPENDED:
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/** Liegt auf dieser Lizenzzeile eine Sperre? */
export function isSuspendedStatus(statusId?: number | null): boolean {
  return Number(statusId) === LICENSE_STATUS_SUSPENDED;
}

/** Lizenz ist beantragt (License::REQUESTED). */
export const LICENSE_STATUS_REQUESTED = 2;

/** Zeitstempel als Vergleichsschlüssel; ein Eintrag ohne zählt als ältester. */
function historyKey(entry?: PlayerLicenseHistory | null): string {
  return String(entry?.created_at ?? '');
}

/**
 * Der jüngste History-Eintrag einer Lizenz.
 *
 * Nicht das letzte Array-Element. Die History ist nicht sortiert: Beim
 * Spieler-Merge werden die Verläufe zweier Profile schlicht aneinandergehängt
 * (`Player#merge`, api), und gemischte Zeitzonen-Offsets können die
 * Reihenfolge ohnehin umkehren. Die API liest den Eintrag deshalb über
 * `max_by { created_at.to_s }` (LicenseEffectiveStatus).
 *
 * Diese Faltung bildet genau das nach, bis in den Gleichstand hinein: Sie
 * beginnt beim ERSTEN Eintrag und ersetzt nur bei einem echt jüngeren. Tragen
 * mehrere Einträge denselben Zeitstempel, gewinnt also der früheste im Array,
 * dasselbe tut Rubys `max_by`. Ein Eintrag ohne Zeitstempel verliert gegen
 * jeden datierten, an welcher Stelle er auch steht; tragen alle keinen, bleibt
 * es beim ersten.
 *
 * Der Vergleich als Zeichenkette ist nur bei EINHEITLICHEM Offset auch
 * chronologisch. `Time#as_json` schreibt den Offset mit, und
 * `…T23:59:00.000+02:00` sortiert hinter `…T18:25:00.000+00:00`, obwohl es
 * früher liegt. Die API hat dieselbe Schwäche (`created_at.to_s`), die Anzeige
 * weicht davon also nicht ab.
 *
 * Bei leerer oder fehlender History kommt `undefined` heraus.
 */
export function latestLicenseHistory(
  history?: PlayerLicenseHistory[] | null
): PlayerLicenseHistory | undefined {
  const entries = history ?? [];

  return entries.reduce<PlayerLicenseHistory | undefined>(
    (newest, entry) =>
      historyKey(entry) > historyKey(newest) ? entry : newest,
    entries[0]
  );
}

/**
 * Die History in zeitlicher Reihenfolge, älteste zuerst, als Kopie.
 *
 * Gleicher Schlüssel wie `latestLicenseHistory`, damit die Anzeige und die
 * Statusentscheidung nie auseinanderlaufen: Der letzte Eintrag dieser Liste
 * ist bei gleichem Zeitstempel allerdings der spätere im Array, die Faltung
 * oben nimmt den früheren. Das betrifft nur exakt gleiche Zeitstempel.
 * `Array#sort` ist stabil, Einträge ohne Zeitstempel stehen vorne.
 */
export function chronologicalLicenseHistory(
  history?: PlayerLicenseHistory[] | null
): PlayerLicenseHistory[] {
  return [...(history ?? [])].sort((a, b) => {
    const ka = historyKey(a);
    const kb = historyKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/**
 * Zählt die Lizenz als aktiv (erteilt oder beantragt), gemessen am jüngsten
 * History-Eintrag? `Number`, weil die Status-ID aus JSONB auch als
 * Zeichenkette ankommen kann.
 */
export function isActiveLicenseHistory(
  history?: PlayerLicenseHistory[] | null
): boolean {
  const status = Number(latestLicenseHistory(history)?.license_status_id);
  return (
    status === LICENSE_STATUS_APPROVED || status === LICENSE_STATUS_REQUESTED
  );
}
