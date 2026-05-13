import { SortPlayersPipe } from './sort-players.pipe';
import { Player } from '@floorball/types';

describe('SortPlayersPipe', () => {
  let pipe: SortPlayersPipe;

  beforeEach(() => {
    pipe = new SortPlayersPipe();
  });

  function player(id: number, last_name: string, first_name: string): Player {
    return { id, last_name, first_name } as Player;
  }

  it('sortiert nach Nachname aufsteigend', () => {
    const players = [player(1, 'Ziegler', 'Anna'), player(2, 'Müller', 'Bob')];
    const result = pipe.transform(players);
    expect(result[0].last_name).toBe('Müller');
    expect(result[1].last_name).toBe('Ziegler');
  });

  it('sortiert bei gleichem Nachnamen nach Vorname', () => {
    const players = [player(1, 'Müller', 'Zara'), player(2, 'Müller', 'Anna')];
    const result = pipe.transform(players);
    expect(result[0].first_name).toBe('Anna');
    expect(result[1].first_name).toBe('Zara');
  });

  it('leere Liste ergibt leere Liste', () => {
    expect(pipe.transform([])).toEqual([]);
  });

  it('Einzelelement bleibt unverändert', () => {
    const players = [player(1, 'Müller', 'Hans')];
    expect(pipe.transform(players)).toEqual(players);
  });
});
