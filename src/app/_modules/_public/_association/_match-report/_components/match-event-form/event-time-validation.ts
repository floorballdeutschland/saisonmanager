import { League } from '@floorball/types';

/**
 * Gültiger Zeitbereich (kumulierte Spielzeit in Sekunden, beide Grenzen
 * inklusive) für einen Spielabschnitt.
 */
export interface PeriodTimeRange {
  startSeconds: number;
  endSeconds: number;
}

export type LeaguePeriodSettings = Pick<
  League,
  'periods' | 'period_length' | 'overtime_length'
>;

/**
 * Liefert den gültigen Zeitbereich für einen Spielabschnitt.
 *
 * Die Ereigniszeit im Spielbericht ist die kumulierte Spielzeit über das
 * gesamte Spiel (z. B. läuft bei 3 Perioden à 20 Minuten die 2. Periode
 * von 20:00 bis 40:00).
 *
 * - Reguläre Periode p (1..periods): (p-1)*period_length bis p*period_length
 * - Verlängerung (periods+1): periods*period_length bis
 *   periods*period_length + overtime_length
 * - Penalty-Schießen (> periods+1), fehlende Liga-Einstellungen oder
 *   unbekannte Periode: keine Begrenzung (null)
 */
export function getPeriodTimeRange(
  league: LeaguePeriodSettings | null | undefined,
  period: number
): PeriodTimeRange | null {
  if (!league?.periods || !league.period_length) {
    return null;
  }
  if (!Number.isInteger(period) || period < 1) {
    return null;
  }

  const periodLengthSeconds = league.period_length * 60;

  if (period <= league.periods) {
    return {
      startSeconds: (period - 1) * periodLengthSeconds,
      endSeconds: period * periodLengthSeconds,
    };
  }

  // Verlängerung
  if (period === league.periods + 1) {
    if (!league.overtime_length) {
      return null;
    }
    const regularEndSeconds = league.periods * periodLengthSeconds;
    return {
      startSeconds: regularEndSeconds,
      endSeconds: regularEndSeconds + league.overtime_length * 60,
    };
  }

  // Penalty-Schießen o. Ä.: keine sinnvolle Zeitbegrenzung
  return null;
}

/**
 * Prüft, ob eine eingegebene Ereigniszeit plausibel ist: Sekunden 0–59,
 * keine negativen Werte und – sofern ein Bereich bekannt ist – innerhalb
 * des Spielabschnitts (Grenzen inklusive).
 */
export function isEventTimeInRange(
  range: PeriodTimeRange | null,
  minutes: number,
  seconds: number
): boolean {
  if (minutes < 0 || seconds < 0 || seconds > 59) {
    return false;
  }
  if (!range) {
    return true;
  }
  const totalSeconds = minutes * 60 + seconds;
  return totalSeconds >= range.startSeconds && totalSeconds <= range.endSeconds;
}

/** Formatiert Sekunden als Spielzeit, z. B. 1200 → "20:00". */
export function formatSecondsAsGameTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
