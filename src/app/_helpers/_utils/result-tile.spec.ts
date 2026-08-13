import { Game } from '@floorball/types';
import {
  looksLikeYouthLeague,
  renderResultTile,
  scorerEntriesForTest,
} from './result-tile';

describe('looksLikeYouthLeague', () => {
  // Grundlage der Voreinstellung, nicht der Absicherung: Eine umbenannte Liga
  // rutscht durch, entscheiden muss die Person am Knopf.
  it('erkennt die gaengigen Jugendbezeichnungen', () => {
    [
      'U13 Junioren',
      'U 17 Juniorinnen',
      'Jugendliga Nord',
      'Schüler-Liga',
      'Minis West',
    ].forEach((name) => {
      expect(looksLikeYouthLeague(name)).withContext(name).toBeTrue();
    });
  });

  it('haelt Erwachsenenligen nicht fuer Jugend', () => {
    [
      '1. Bundesliga Herren',
      '2. Bundesliga Damen',
      'Regionalliga Nord',
      'DFBL-Pokal',
      '',
      null,
    ].forEach((name) => {
      expect(looksLikeYouthLeague(name)).withContext(String(name)).toBeFalse();
    });
  });
});

describe('renderResultTile', () => {
  function game(overrides: Partial<Game> = {}): Game {
    return {
      id: 4711,
      game_number: '12',
      date: '2026-08-10',
      league_name: '1. Bundesliga Herren',
      home_team_name: 'Heimverein',
      guest_team_name: 'Gastverein',
      home_team_logo: null,
      guest_team_logo: null,
      result: {
        home_goals: 3,
        guest_goals: 1,
        home_goals_period: [2, 1, 0, 0],
        guest_goals_period: [1, 0, 0, 0],
      },
      // Genau die Form, die der Spielbericht liefert: Trikotnummer in `number`,
      // KEIN aufgelöster Name. Genau daran wäre der Torschützenblock lautlos
      // leer geblieben.
      events: [
        { event_type: 'goal', event_team: 'home', time: '05:00', number: 17 },
        { event_type: 'goal', event_team: 'guest', time: '09:30', number: 9 },
        // Eigentor: Pseudonummer 1000, darf keinem Spieler zugeschrieben werden.
        {
          event_type: 'goal',
          event_team: 'home',
          time: '11:00',
          number: 1000,
          goal_type_string: 'Eigentor',
        },
      ],
      players: {
        home: [
          {
            trikot_number: 17,
            player_firstname: 'Max',
            player_name: 'Mustermann',
          },
          {
            trikot_number: null,
            player_firstname: 'Ohne',
            player_name: 'Nummer',
          },
        ],
        guest: [
          { trikot_number: 9, player_firstname: 'Lena', player_name: 'Gast' },
        ],
      },
      ...overrides,
    } as unknown as Game;
  }

  it('liefert ein Hochformat in 1080 x 1920', async () => {
    const blob = await renderResultTile({ game: game(), format: 'story' });

    expect(blob).toBeTruthy();
    const size = await imageSize(blob!);
    expect(size).toEqual({ width: 1080, height: 1920 });
  });

  it('liefert ein Quadrat in 1080 x 1080', async () => {
    const blob = await renderResultTile({ game: game(), format: 'square' });

    const size = await imageSize(blob!);
    expect(size).toEqual({ width: 1080, height: 1080 });
  });

  // Ein Spiel ohne Ergebnis darf kein Bild verhindern und auch kein 0:0
  // behaupten. Geprüft wird hier nur, dass es überhaupt eine Kachel gibt: Was
  // auf ihr steht, lässt sich aus einem PNG nicht zurücklesen.
  it('erzeugt auch ohne Ergebnis und ohne Ereignisse eine Kachel', async () => {
    const blob = await renderResultTile({
      game: game({ result: null, events: [] } as unknown as Partial<Game>),
      format: 'square',
    });

    expect(blob).toBeTruthy();
    expect(blob!.type).toBe('image/png');
  });

  it('kommt mit einem unbrauchbaren Logo-Pfad zurecht', async () => {
    const blob = await renderResultTile({
      game: game({
        home_team_logo: '/gibt-es-nicht.png',
      } as unknown as Partial<Game>),
      format: 'square',
    });

    expect(blob).toBeTruthy();
  });

  // Der Spielbericht liefert Trikotnummern, keine Namen — aufgelöste Namen
  // hängt nur OverlayPayload an, und der bedient die Overlays. Ohne eigene
  // Auflösung bliebe der Torschützenblock leer, und zwar ohne Fehlermeldung.
  it('loest Trikotnummern ueber die Aufstellung zu Namen auf', () => {
    const entries = scorerEntriesForTest(game());

    expect(entries.map((e) => e.label)).toEqual([
      'M. Mustermann',
      'L. Gast',
      'Eigentor',
    ]);
  });

  it('schreibt ein Eigentor keinem Spieler zu', () => {
    // Pseudonummer 1000 darf nicht in der Aufstellung nachgeschlagen werden.
    const entries = scorerEntriesForTest(
      game({
        events: [
          {
            event_type: 'goal',
            event_team: 'home',
            time: '11:00',
            number: 1000,
          },
        ],
      } as unknown as Partial<Game>)
    );

    expect(entries[0].label).toBe('Tor');
  });

  // Dieselbe Rueckennummer auf beiden Seiten ist der Normalfall, nicht die
  // Ausnahme. Eine Aufloesung ueber einen gemeinsamen Topf benennt dann die
  // gegnerische Person als Torschuetzin, und zwar auf einem Bild, das direkt in
  // die sozialen Netze geht.
  it('haelt dieselbe Trikotnummer auf beiden Seiten auseinander', () => {
    const entries = scorerEntriesForTest(
      game({
        events: [
          { event_type: 'goal', event_team: 'home', time: '05:00', number: 7 },
          { event_type: 'goal', event_team: 'guest', time: '09:30', number: 7 },
        ],
        players: {
          home: [
            {
              trikot_number: 7,
              player_firstname: 'Heimische',
              player_name: 'Person',
            },
          ],
          guest: [
            {
              trikot_number: 7,
              player_firstname: 'Gaestische',
              player_name: 'Person',
            },
          ],
        },
      } as unknown as Partial<Game>)
    );

    expect(entries.map((e) => e.label)).toEqual(['H. Person', 'G. Person']);
  });

  it('faellt auf die Torart zurueck, wenn die Nummer nicht in der Aufstellung steht', () => {
    const entries = scorerEntriesForTest(
      game({
        events: [
          {
            event_type: 'goal',
            event_team: 'home',
            time: '05:00',
            number: 88,
            goal_type_string: 'Tor',
          },
        ],
      } as unknown as Partial<Game>)
    );

    expect(entries[0].label).toBe('Tor');
  });

  it('zaehlt nur Tore, keine Strafen', () => {
    const entries = scorerEntriesForTest(
      game({
        events: [
          { event_type: 'goal', event_team: 'home', time: '05:00', number: 17 },
          {
            event_type: 'penalty_2',
            event_team: 'guest',
            time: '07:00',
            number: 9,
          },
        ],
      } as unknown as Partial<Game>)
    );

    expect(entries.map((e) => e.label)).toEqual(['M. Mustermann']);
  });

  it('nimmt einen bereits aufgeloesten Namen, wenn einer mitkommt', () => {
    const entries = scorerEntriesForTest(
      game({
        events: [
          {
            event_type: 'goal',
            event_team: 'home',
            time: '05:00',
            number: 17,
            scorer_name: 'Aus dem Overlay',
          },
        ],
      } as unknown as Partial<Game>)
    );

    expect(entries[0].label).toBe('Aus dem Overlay');
  });

  function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Kachel nicht lesbar'));
      };
      img.src = url;
    });
  }
});
