import { NormalizeEventPipe } from './normalize-event.pipe';
import {
  Game,
  GameAdditionalFields,
  GameCoach,
  GameEvent,
} from '@floorball/types';

// Betreuer tragen keine Trikotnummer; Strafen gegen sie liegen unter
// 2000 + Betreuerplatz.
describe('NormalizeEventPipe', () => {
  const pipe = new NormalizeEventPipe();

  const coach = (slot: number, first: string, last: string): GameCoach => ({
    slot,
    first_name: first,
    last_name: last,
    name: `${last}, ${first}`,
  });

  const game = (partial: Partial<Game> = {}) =>
    ({
      players: {
        home: [
          {
            player_id: 11,
            player_name: 'Fischer',
            player_firstname: 'Dana',
            trikot_number: 7,
            goalkeeper: false,
          },
        ],
        guest: [],
      },
      ...partial,
    }) as Game;

  const penalty = (number: number, team: 'home' | 'guest'): GameEvent =>
    ({ event_type: 'penalty', event_team: team, number }) as GameEvent;

  it('loest gewoehnliche Trikotnummern aus der Aufstellung auf', () => {
    const result = pipe.transform(penalty(7, 'home'), game());

    expect(result?.home.scorer?.player_name).toBe('Fischer');
  });

  it('benennt den Betreuer aus der oeffentlichen Liste', () => {
    const result = pipe.transform(
      penalty(2002, 'home'),
      game({
        home_coaches: [coach(1, 'Anna', 'Meier'), coach(2, 'Bruno', 'Sanchez')],
      })
    );

    expect(result?.home.scorer?.player_firstname).toBe('Bruno');
    expect(result?.home.scorer?.player_name).toBe('Sanchez');
    expect(result?.home.scorer?.trikot_number).toBe(2002);
  });

  it('trennt Heim- und Gastbetreuer', () => {
    const result = pipe.transform(
      penalty(2001, 'guest'),
      game({
        home_coaches: [coach(1, 'Anna', 'Meier')],
        guest_coaches: [coach(1, 'Bruno', 'Sanchez')],
      })
    );

    expect(result?.guest.scorer?.player_name).toBe('Sanchez');
  });

  it('nimmt die internen Felder, wo sie vorliegen', () => {
    const additionalFields = {
      home_team_coaches: {
        coach1_first_name: 'Anna',
        coach1_last_name: 'Meier',
      },
    } as unknown as GameAdditionalFields;

    const result = pipe.transform(
      penalty(2001, 'home'),
      game(),
      additionalFields
    );

    expect(result?.home.scorer?.player_name).toBe('Meier');
  });

  it('setzt den Sammelnamen ein, wenn die Namensteile fehlen', () => {
    const legacy: GameCoach = {
      slot: 1,
      first_name: '',
      last_name: '',
      name: 'Meier, Anna',
    };

    const result = pipe.transform(
      penalty(2001, 'home'),
      game({ home_coaches: [legacy] })
    );

    expect(result?.home.scorer?.player_name).toBe('Meier, Anna');
  });

  // Die API setzt `name` aus den vorhandenen Teilen zusammen; ein Platz mit
  // bloss einem Vornamen liefert `name === first_name`. Ohne Sonderfall stuende
  // er zweimal in der Zeile.
  it('schreibt einen halb gefuellten Namen nicht doppelt', () => {
    const halfFilled: GameCoach = {
      slot: 1,
      first_name: 'Anna',
      last_name: '',
      name: 'Anna',
    };

    const result = pipe.transform(
      penalty(2001, 'home'),
      game({ home_coaches: [halfFilled] })
    );

    expect(result?.home.scorer?.player_firstname).toBe('Anna');
    expect(result?.home.scorer?.player_name).toBe('');
  });

  it('die internen Felder gewinnen gegen die oeffentliche Liste', () => {
    const additionalFields = {
      home_team_coaches: {
        coach1_first_name: 'Anna',
        coach1_last_name: 'Meier',
      },
    } as unknown as GameAdditionalFields;

    const result = pipe.transform(
      penalty(2001, 'home'),
      game({ home_coaches: [coach(1, 'Dana', 'Fischer')] }),
      additionalFields
    );

    expect(result?.home.scorer?.player_name).toBe('Meier');
  });

  it('bleibt ohne passenden Betreuer ohne Namen', () => {
    const result = pipe.transform(
      penalty(2003, 'home'),
      game({ home_coaches: [coach(1, 'Anna', 'Meier')] })
    );

    expect(result?.home.scorer).toBeUndefined();
  });
});
