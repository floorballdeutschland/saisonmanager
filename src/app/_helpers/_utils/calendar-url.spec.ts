import { environment } from 'src/environments/environment';
import { calendarUrl } from './calendar-url';

describe('calendarUrl', () => {
  // Der Kern des Fixes: Die Adresse muss über die API-Basis laufen. Ein
  // anwendungseigener Pfad (/calendar/...) erreicht Rails nicht, weil nginx nur
  // /api und /verband weiterreicht – genau daran waren die Links wirkungslos.
  it('baut die Adresse auf der API-Basis auf, nicht als Anwendungspfad', () => {
    const url = calendarUrl('teams', 7488);

    expect(url.startsWith(environment.apiURL)).toBeTrue();
    expect(url).toBe(`${environment.apiURL}calendar/teams/7488.ics`);
  });

  it('deckt Liga und Einzelspiel ab', () => {
    expect(calendarUrl('leagues', 2499)).toBe(
      `${environment.apiURL}calendar/leagues/2499.ics`
    );
    expect(calendarUrl('games', '45703')).toBe(
      `${environment.apiURL}calendar/games/45703.ics`
    );
  });
});
