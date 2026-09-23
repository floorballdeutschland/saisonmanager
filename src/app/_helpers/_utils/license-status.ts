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

/**
 * Sortierschlüssel eines History-Eintrags, dieselbe Regel wie
 * `LicenseEffectiveStatus` in der API (api#747):
 *
 * - lesbarer Zeitstempel: `[1, Zeitpunkt, Text]`
 * - unlesbarer oder fehlender: `[0, Text]`
 *
 * Verglichen wird also zuerst, ob der Eintrag datiert ist (undatiert verliert
 * gegen jeden datierten), dann der Zeitpunkt, und erst bei gleichem Zeitpunkt
 * der Text. Lesbar ist nur, was mit JJJJ-MM-TT beginnt, wie der ISO-Guard der
 * API (`Player#_parse_zeitpunkt`); ohne ihn läse `Date.parse` auch Formen wie
 * „08/24/2026", die die API als undatiert behandelt.
 */
type HistoryKey = [number, number, string];

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

function historyKey(entry?: PlayerLicenseHistory | null): HistoryKey {
  const text = String(entry?.created_at ?? '');
  const time = ISO_DATE_PREFIX.test(text) ? Date.parse(text) : NaN;

  return Number.isNaN(time) ? [0, 0, text] : [1, time, text];
}

function compareKeys(a: HistoryKey, b: HistoryKey): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/**
 * Der jüngste History-Eintrag einer Lizenz.
 *
 * Nicht das letzte Array-Element. Die History ist nicht sortiert: Beim
 * Spieler-Merge werden die Verläufe zweier Profile schlicht aneinandergehängt
 * (`Player#merge`, api). Auch der Text allein ordnet nicht: `Time#as_json`
 * schreibt den Offset mit, und `…T19:59:00+02:00` sortiert als Text hinter
 * `…T18:25:00+00:00`, obwohl es früher liegt. Verglichen werden deshalb
 * Zeitpunkte, siehe `historyKey`; die API tut seit api#747 dasselbe.
 *
 * Die Faltung beginnt beim ERSTEN Eintrag und ersetzt nur bei einem echt
 * größeren Schlüssel. Bei vollem Gleichstand gewinnt also der früheste im
 * Array, dasselbe tut Rubys `max_by`.
 *
 * Bei leerer oder fehlender History kommt `undefined` heraus.
 */
export function latestLicenseHistory(
  history?: PlayerLicenseHistory[] | null
): PlayerLicenseHistory | undefined {
  const entries = history ?? [];

  return entries.reduce<PlayerLicenseHistory | undefined>(
    (newest, entry) =>
      compareKeys(historyKey(entry), historyKey(newest)) > 0 ? entry : newest,
    entries[0]
  );
}

/**
 * Die History in zeitlicher Reihenfolge, älteste zuerst, als Kopie.
 *
 * Gleicher Schlüssel wie `latestLicenseHistory`, und bei vollem Gleichstand
 * dieselbe Entscheidung: Der frühere Eintrag im Array gilt als jünger und
 * steht deshalb weiter hinten. So ist der letzte angezeigte Eintrag immer der,
 * aus dem der Status kommt. Undatierte Einträge stehen vorne.
 */
export function chronologicalLicenseHistory(
  history?: PlayerLicenseHistory[] | null
): PlayerLicenseHistory[] {
  return (history ?? [])
    .map((entry, index) => ({ entry, index, key: historyKey(entry) }))
    .sort((a, b) => compareKeys(a.key, b.key) || b.index - a.index)
    .map(({ entry }) => entry);
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
