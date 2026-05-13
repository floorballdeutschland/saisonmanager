import { TeamLineupPlayerPipe } from './team-lineup-player.pipe';
import { GamePlayerEntry, PlayerWithLicense } from '@floorball/types';

describe('TeamLineupPlayerPipe', () => {
  let pipe: TeamLineupPlayerPipe;

  beforeEach(() => {
    pipe = new TeamLineupPlayerPipe();
  });

  function player(
    id: number,
    last_name = 'Z',
    first_name = 'A'
  ): PlayerWithLicense {
    return { id, last_name, first_name } as PlayerWithLicense;
  }

  function entry(player_id: number): GamePlayerEntry {
    return { player_id } as GamePlayerEntry;
  }

  describe('mode: all', () => {
    it('gibt alle Spieler zurück', () => {
      const players = [player(1), player(2)];
      const lineup = [entry(1)];
      const result = pipe.transform(players, lineup, 'all');
      expect(result.length).toBe(2);
    });

    it('setzt gamePlayerEntry für aufgestellte Spieler', () => {
      const players = [player(1), player(2)];
      const lineup = [entry(1)];
      const result = pipe.transform(players, lineup, 'all');
      const p1 = result.find((r) => r.player.id === 1);
      const p2 = result.find((r) => r.player.id === 2);
      expect(p1?.gamePlayerEntry).toBeTruthy();
      expect(p2?.gamePlayerEntry).toBeNull();
    });
  });

  describe('mode: selected', () => {
    it('gibt nur aufgestellte Spieler zurück', () => {
      const players = [player(1), player(2), player(3)];
      const lineup = [entry(1), entry(3)];
      const result = pipe.transform(players, lineup, 'selected');
      expect(result.length).toBe(2);
      expect(result.map((r) => r.player.id)).toEqual(
        jasmine.arrayContaining([1, 3])
      );
    });

    it('leere Aufstellung ergibt leere Liste', () => {
      const players = [player(1), player(2)];
      const result = pipe.transform(players, [], 'selected');
      expect(result.length).toBe(0);
    });
  });

  describe('mode: not-selected', () => {
    it('gibt nur nicht aufgestellte Spieler zurück', () => {
      const players = [player(1), player(2), player(3)];
      const lineup = [entry(2)];
      const result = pipe.transform(players, lineup, 'not-selected');
      expect(result.length).toBe(2);
      expect(result.map((r) => r.player.id)).toEqual(
        jasmine.arrayContaining([1, 3])
      );
    });

    it('alle aufgestellt → leere Liste', () => {
      const players = [player(1)];
      const lineup = [entry(1)];
      const result = pipe.transform(players, lineup, 'not-selected');
      expect(result.length).toBe(0);
    });
  });

  describe('Sortierung', () => {
    it('sortiert nach Nachname, dann Vorname', () => {
      const players = [
        player(1, 'Ziegler', 'Anna'),
        player(2, 'Müller', 'Bert'),
        player(3, 'Müller', 'Anna'),
      ];
      const result = pipe.transform(players, [], 'all');
      expect(result[0].player.id).toBe(3); // Müller, Anna
      expect(result[1].player.id).toBe(2); // Müller, Bert
      expect(result[2].player.id).toBe(1); // Ziegler, Anna
    });
  });
});
