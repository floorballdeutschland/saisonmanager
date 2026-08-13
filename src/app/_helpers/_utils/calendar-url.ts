import { environment } from 'src/environments/environment';

/**
 * Adresse eines Kalender-Abos (ICS).
 *
 * Muss über `environment.apiURL` laufen, nicht als anwendungseigener Pfad
 * (`/calendar/...`): nginx reicht nur `/api` und `/verband` an die API weiter,
 * alles andere landet im Frontend-Fallback. Genau daran waren die Links vorher
 * wirkungslos – der Angular-Router bekam den Pfad und warf NG04002
 * (Sentry SAISONMANAGER-2C).
 */
export function calendarUrl(
  kind: 'teams' | 'leagues' | 'games',
  id: string | number
): string {
  return `${environment.apiURL}calendar/${kind}/${id}.ics`;
}
