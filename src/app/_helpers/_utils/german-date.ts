/**
 * Parst ein Datum im deutschen Format „TT.MM.JJJJ“, wie es die API in den
 * Schiedsrichter-Antworten ausliefert (`gueltigkeit`, `valid_until`).
 *
 * `null` steht fuer „keine Angabe oder unlesbar“. Die Unterscheidung, ob eine
 * fehlende Angabe als abgelaufen gilt, gehoert zum Feld und nicht hierher:
 * Bei der Lizenzgueltigkeit ist ein fehlendes Datum ein fehlender Nachweis
 * (also nicht gueltig), bei einer Zusatzqualifikation heisst es nur, dass kein
 * Ablauf hinterlegt ist.
 *
 * Bewusst kein `new Date(string)`: Das liest „01.02.2026“ je nach Browser als
 * Invalid Date oder als 1. Februar bzw. 2. Januar. Hier wird nur das eine
 * Format akzeptiert, alles andere ist `null`.
 */
export function parseGermanDate(value?: string | null): Date | null {
  if (!value) return null;

  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, day, month, year] = match;
  const parsed = new Date(+year, +month - 1, +day);

  // Rollover abweisen: Aus dem 31.02. macht der Date-Konstruktor stillschweigend
  // den 3. Maerz. Ein solches Datum ist keine Gueltigkeit, sondern ein Tippfehler.
  if (
    parsed.getFullYear() !== +year ||
    parsed.getMonth() !== +month - 1 ||
    parsed.getDate() !== +day
  ) {
    return null;
  }

  return parsed;
}

/**
 * `true`, wenn das Datum vor heute liegt. Ein unlesbares Datum gilt als
 * abgelaufen, damit im Zweifel nicht faelschlich „gueltig“ (gruen) ausgegeben
 * wird; eine fehlende Angabe ist dagegen keine Aussage und damit `false`.
 */
export function isGermanDateExpired(value?: string | null): boolean {
  if (!value) return false;
  const parsed = parseGermanDate(value);
  return !parsed || parsed < new Date();
}
