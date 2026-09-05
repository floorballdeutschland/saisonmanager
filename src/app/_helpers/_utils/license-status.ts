/**
 * Anzeige des Lizenzstatus.
 *
 * Eine Stelle für die Farbgebung, weil derselbe Status in der Lizenzliste
 * einer Liga, in der Verbandsübersicht und in der Vereinsansicht steht. Vor
 * api#605 stand die Zuordnung als verschachtelte Bedingung in den Templates,
 * und der Status `gesperrt` fiel dort in den grauen Rest -- was ihn von
 * „zurückgezogen" nicht unterschied.
 */

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
