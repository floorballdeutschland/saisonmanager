import { Game } from '@floorball/types';
import { looksLikeYouthLeague, renderResultTile } from './result-tile';

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
      events: [
        {
          event_type: 'goal',
          time: '05:00',
          scorer_name: 'M. Mustermann',
        },
      ],
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
