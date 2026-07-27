import { League } from '@floorball/types';

export type LeaguePeriodSettings = Pick<
  League,
  'periods' | 'period_length' | 'overtime_length'
>;

/**
 * Liefert die höchste zulässige Ereigniszeit eines Spielabschnitts in Sekunden
 * (Grenze inklusive) oder null, wenn keine Begrenzung greift.
 *
 * Die Spieluhr startet in jedem Abschnitt neu bei 0:00 – genau so, wie die
 * Zeitnehmer sie ablesen. Eine Ereigniszeit liegt daher unabhängig vom
 * Abschnitt immer zwischen 0:00 und der Länge des Abschnitts.
 *
 * - Reguläre Periode (1..periods): period_length
 * - Verlängerung (periods + 1): overtime_length
 * - Penalty-Schießen (> periods + 1), fehlende Liga-Einstellungen oder
 *   unbekannte Periode: keine Begrenzung (null)
 */
export function getPeriodMaxSeconds(
  league: LeaguePeriodSettings | null | undefined,
  period: number
): number | null {
  if (!league?.periods || !league.period_length) {
    return null;
  }
  if (!Number.isInteger(period) || period < 1) {
    return null;
  }

  if (period <= league.periods) {
    return league.period_length * 60;
  }

  // Verlängerung
  if (period === league.periods + 1) {
    return league.overtime_length ? league.overtime_length * 60 : null;
  }

  // Penalty-Schießen o. Ä.: keine sinnvolle Zeitbegrenzung
  return null;
}

/**
 * Prüft, ob eine eingegebene Ereigniszeit plausibel ist: Sekunden 0–59,
 * keine negativen Werte und – sofern eine Obergrenze bekannt ist – nicht
 * länger als der Spielabschnitt (Grenze inklusive).
 */
export function isEventTimeValid(
  maxSeconds: number | null,
  minutes: number,
  seconds: number
): boolean {
  if (minutes < 0 || seconds < 0 || seconds > 59) {
    return false;
  }
  if (maxSeconds === null) {
    return true;
  }
  return minutes * 60 + seconds <= maxSeconds;
}

/** Formatiert Sekunden als Spielzeit, z. B. 1200 → "20:00". */
export function formatSecondsAsGameTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
