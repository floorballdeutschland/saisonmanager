import { GameScheduleEntry } from '@floorball/types';

import { FinalRoundsPipe } from './final-rounds.pipe';

const entry = (partial: Partial<GameScheduleEntry>): GameScheduleEntry =>
  partial as GameScheduleEntry;

describe('FinalRoundsPipe', () => {
  let pipe: FinalRoundsPipe;

  beforeEach(() => {
    pipe = new FinalRoundsPipe();
  });

  it('filtert Gruppenspiele raus und gruppiert nach series_title', () => {
    const rounds = pipe.transform([
      entry({ game_id: 1, group_identifier: 'group_a', series_title: null }),
      entry({ game_id: 2, group_identifier: null, series_title: 'Halbfinale' }),
      entry({ game_id: 3, group_identifier: null, series_title: 'Halbfinale' }),
      entry({
        game_id: 4,
        group_identifier: null,
        series_title: 'Spiel um Platz 3',
      }),
      entry({ game_id: 5, group_identifier: null, series_title: 'Finale' }),
    ]);

    expect(rounds.length).toBe(3);
    expect(rounds[0].round_title).toBe('Halbfinale');
    expect(rounds[0].matches.map((m) => m.game_id)).toEqual([2, 3]);
    expect(rounds[1].round_title).toBe('Spiel um Platz 3');
    expect(rounds[2].round_title).toBe('Finale');
  });

  it('entfernt Ziffern aus dem Rundentitel bei Runden mit mehreren Spielen', () => {
    const rounds = pipe.transform([
      entry({
        game_id: 1,
        group_identifier: null,
        series_title: 'Viertelfinale 1',
      }),
      entry({
        game_id: 2,
        group_identifier: null,
        series_title: 'Viertelfinale 1',
      }),
    ]);

    expect(rounds.length).toBe(1);
    expect(rounds[0].round_title).toBe('Viertelfinale');
  });

  it('behält Ziffern im Titel bei Runden mit nur einem Spiel', () => {
    const rounds = pipe.transform([
      entry({
        game_id: 1,
        group_identifier: null,
        series_title: 'Spiel um Platz 5',
      }),
    ]);

    expect(rounds[0].round_title).toBe('Spiel um Platz 5');
  });

  it('liefert eine leere Liste, wenn alle Spiele einer Gruppe zugeordnet sind', () => {
    const rounds = pipe.transform([
      entry({ game_id: 1, group_identifier: 'group_a' }),
      entry({ game_id: 2, group_identifier: 'group_b' }),
    ]);

    expect(rounds).toEqual([]);
  });
});
