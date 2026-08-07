import { normalizeSecretaryPayload } from './game.service';

// Frontend und API werden getrennt ausgerollt. Für die Dauer eines Deploys kann
// ein neues Bundle mit einer alten API sprechen, die `game_days` noch nicht
// kennt und an den Spielen kein `game_day_id` mitschickt. Der Ausgleich sitzt
// bewusst nur hier, damit die Ansicht ihn nicht kennen muss.
describe('normalizeSecretaryPayload', () => {
  const day = (id: number, league: string) => ({
    id,
    date: '2026-01-01',
    league,
    league_id: id * 10,
    arena: 'Halle',
    game_operation_slug: 'fd',
  });

  const base = {
    license_lists: {},
    expires_at: '2026-01-02T00:00:00Z',
  };

  it('übernimmt die neue Antwort unverändert', () => {
    const result = normalizeSecretaryPayload({
      ...base,
      game_day: day(1, 'U15'),
      game_days: [day(1, 'U15'), day(2, 'U17')],
      games: [{ id: 7, game_day_id: 2 }],
    });

    expect(result.game_days.map((d) => d.id)).toEqual([1, 2]);
    expect(result.games[0].game_day_id).toBe(2);
  });

  it('macht aus der alten Antwort eine Spieltagsliste mit einem Eintrag', () => {
    const result = normalizeSecretaryPayload({
      ...base,
      game_day: day(1, 'U15'),
      games: [{ id: 7 }],
    });

    expect(result.game_days.map((d) => d.id)).toEqual([1]);
  });

  // Ohne game_days gibt es genau einen Spieltag, also gehört jedes Spiel dazu.
  // Bliebe game_day_id leer, fände matchReportUrl den Spieltag nicht und die
  // Spiele wären unverlinkt.
  it('trägt den fehlenden Spieltag an den Spielen nach', () => {
    const result = normalizeSecretaryPayload({
      ...base,
      game_day: day(1, 'U15'),
      games: [{ id: 7 }, { id: 8 }],
    });

    expect(result.games.map((g) => g.game_day_id)).toEqual([1, 1]);
  });

  it('behandelt eine leere Spieltagsliste wie die alte Antwort', () => {
    const result = normalizeSecretaryPayload({
      ...base,
      game_day: day(1, 'U15'),
      game_days: [],
      games: [],
    });

    expect(result.game_days.map((d) => d.id)).toEqual([1]);
  });
});
