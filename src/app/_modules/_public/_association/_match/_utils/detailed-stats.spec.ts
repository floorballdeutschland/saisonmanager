import {
  DetailedStats,
  DetailedStatsShot,
  GoalkeeperStats,
  PlayerShotStats,
} from '@floorball/types';
import {
  filterShots,
  periodsOf,
  savePercentage,
  sortPlayers,
  teamStatsFor,
  toFieldPoint,
} from './detailed-stats';
import { FIELD_GEOMETRY } from 'src/app/_helpers/_utils/field-geometry';

const RINK = FIELD_GEOMETRY.GF;

function shot(overrides: Partial<DetailedStatsShot> = {}): DetailedStatsShot {
  return {
    team: 'home',
    period: 1,
    game_time: '05:00',
    x: 0.5,
    y: 0.5,
    result: 'saved',
    shooter: null,
    event_id: null,
    ...overrides,
  };
}

const stats = (overrides: Partial<DetailedStats> = {}): DetailedStats => ({
  complete: true,
  shots: [],
  teams: {
    home: {
      shots: 3,
      on_goal: 2,
      goals: 1,
      blocked: 1,
      missed: 0,
      by_period: {
        '1': { shots: 2, on_goal: 1, goals: 1, blocked: 1, missed: 0 },
        '3': { shots: 1, on_goal: 1, goals: 0, blocked: 0, missed: 0 },
      },
    },
    guest: {
      shots: 1,
      on_goal: 0,
      goals: 0,
      blocked: 0,
      missed: 1,
      by_period: {
        '2': { shots: 1, on_goal: 0, goals: 0, blocked: 0, missed: 1 },
      },
    },
  },
  goalkeepers: [],
  players: [],
  ...overrides,
});

describe('detailed-stats utils', () => {
  describe('toFieldPoint', () => {
    it('zeichnet Heim nach rechts angreifend: x wächst nach rechts, links liegt oben', () => {
      expect(toFieldPoint(shot({ team: 'home', x: 0, y: 0 }))).toEqual({
        cx: 0,
        cy: 0,
      });
      expect(toFieldPoint(shot({ team: 'home', x: 1, y: 1 }))).toEqual({
        cx: RINK.length,
        cy: RINK.width,
      });
    });

    it('spiegelt den Gast: Schuss vor dem gegnerischen Tor landet links', () => {
      const point = toFieldPoint(shot({ team: 'guest', x: 0.9, y: 0.5 }));
      expect(point.cx).toBeCloseTo(0.1 * RINK.length, 5);
      expect(point.cy).toBeCloseTo(RINK.width / 2, 5);
    });

    it('dreht den Gast um den Mittelpunkt, damit seine linke Seite unten liegt', () => {
      const home = toFieldPoint(shot({ team: 'home', x: 0.8, y: 0.2 }));
      const guest = toFieldPoint(shot({ team: 'guest', x: 0.8, y: 0.2 }));
      expect(guest.cx).toBeCloseTo(RINK.length - home.cx, 5);
      expect(guest.cy).toBeCloseTo(RINK.width - home.cy, 5);
    });

    it('normiert über das ganze Feld von Bande zu Bande', () => {
      // Torlinie 3,5 m vor der gegnerischen Bande
      expect(toFieldPoint(shot({ x: 36.5 / 40, y: 0.5 }))).toEqual({
        cx: 36.5,
        cy: 10,
      });
    });

    it('rechnet Kleinfeld-Schüsse in Meter des 28 x 16 m-Feldes um', () => {
      const kf = FIELD_GEOMETRY.KF;
      // Torlinie 3 m vor der gegnerischen Bande, mittig
      expect(toFieldPoint(shot({ x: 25 / 28, y: 0.5 }), kf)).toEqual({
        cx: 25,
        cy: 8,
      });
      const guest = toFieldPoint(shot({ team: 'guest', x: 1, y: 0 }), kf);
      expect(guest).toEqual({ cx: 0, cy: 16 });
      expect(toFieldPoint(shot({ x: 5, y: 2 }), kf)).toEqual({
        cx: 28,
        cy: 16,
      });
    });

    it('schneidet Werte außerhalb des Feldes an der Bande ab', () => {
      expect(toFieldPoint(shot({ x: 5, y: -1 }))).toEqual({
        cx: RINK.length,
        cy: 0,
      });
    });
  });

  it('filterShots trennt nach Team und Abschnitt', () => {
    const shots = [
      shot({ team: 'home', period: 1 }),
      shot({ team: 'home', period: 2 }),
      shot({ team: 'guest', period: 1 }),
    ];
    expect(filterShots(shots, 'home', null).length).toBe(2);
    expect(filterShots(shots, 'home', 2)).toEqual([shots[1]]);
    expect(filterShots(shots, 'guest', 2)).toEqual([]);
  });

  it('periodsOf sammelt Abschnitte beider Teams und der Schüsse, sortiert', () => {
    expect(periodsOf(stats({ shots: [shot({ period: 4 })] }))).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('teamStatsFor liefert Gesamtwerte, Abschnittswerte und Nullen für leere Abschnitte', () => {
    const s = stats();
    expect(teamStatsFor(s, 'home', null).shots).toBe(3);
    expect(teamStatsFor(s, 'home', 1).goals).toBe(1);
    expect(teamStatsFor(s, 'home', 2)).toEqual({
      shots: 0,
      on_goal: 0,
      goals: 0,
      blocked: 0,
      missed: 0,
    });
  });

  describe('savePercentage', () => {
    const gk = (saves: number, shots_against: number): GoalkeeperStats => ({
      team: 'home',
      trikot_number: 1,
      name: 'Torhüter',
      saves,
      shots_against,
      save_pct: 0.5,
    });

    it('rechnet Prozent mit einer Nachkommastelle aus Paraden und Schüssen', () => {
      expect(savePercentage(gk(2, 3))).toBe(66.7);
      expect(savePercentage(gk(0, 4))).toBe(0);
    });

    it('ist null ohne Schuss aufs Tor', () => {
      expect(savePercentage(gk(0, 0))).toBeNull();
    });
  });

  it('sortPlayers ordnet nach Schüssen, dann Toren, dann Trikotnummer', () => {
    const p = (
      trikot_number: number | null,
      shots: number,
      goals: number
    ): PlayerShotStats => ({
      team: 'home',
      trikot_number,
      name: String(trikot_number),
      shots,
      on_goal: goals,
      goals,
    });
    const sorted = sortPlayers([
      p(9, 2, 0),
      p(7, 2, 1),
      p(null, 5, 0),
      p(3, 2, 0),
    ]);
    expect(sorted.map((x) => x.trikot_number)).toEqual([null, 7, 3, 9]);
  });
});
