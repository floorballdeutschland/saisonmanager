/** Hilfen für die Kursmasken: Beträge in Cent, Zeiten aus datetime-local. */

export function centsToEuro(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** "25", "25,5", "25.50" → 2500/2550; leer → null; Unsinn → NaN. */
export function euroToCents(value: string | null | undefined): number | null {
  const text = (value ?? '').toString().trim();
  if (text === '') return null;
  if (!/^\d+([.,]\d{1,2})?$/.test(text)) return NaN;
  return Math.round(parseFloat(text.replace(',', '.')) * 100);
}

/** ISO-Zeitpunkt → Wert für <input type="datetime-local"> in Ortszeit. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Wert aus <input type="datetime-local"> (Ortszeit) → ISO mit Zeitzone. */
export function localInputToIso(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
}
