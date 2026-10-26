import { Game, GameEvent, Shot, ShotInput } from '@floorball/types';

import {
  bestClockOffset,
  clockOffsetMs,
  consistentShotFlags,
  defaultGoalkeeperId,
  followsFreeHit,
  fromAttackDirection,
  goalLinkCandidates,
  goaliePulled,
  isFreeHit,
  isUnplacedSave,
  leftToRightTeam,
  mergeShots,
  newClientUuid,
  normalizeGameTime,
  playablePeriods,
  shootingTeamForTap,
  situationFor,
  toAttackDirection,
  toServerTime,
} from './tablet-capture.logic';

function shot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: 1,
    client_uuid: 'a',
    team: 'home',
    period: 1,
    game_time: '',
    tapped_at: '2026-10-16T12:00:00.000Z',
    x: 0.8,
    y: 0.5,
    result: 'goal',
    shooter_player_id: null,
    goalkeeper_player_id: null,
    event_id: null,
    ...overrides,
  };
}

describe('Tabletmodus: Rechenlogik', () => {
  describe('Zeitkorrektur', () => {
    it('nimmt die Mitte des Round-Trips als Lesezeitpunkt des Servers', () => {
      // Gerät geht 5 s nach: Server liest bei Gerätezeit 1000 + 200 = 1200
      // die Uhrzeit 6200.
      const offset = clockOffsetMs({
        sentAt: 1000,
        receivedAt: 1400,
        serverNow: new Date(6200).toISOString(),
      });
      expect(offset).toBe(5000);
    });

    it('verwirft unlesbare Antworten', () => {
      expect(
        clockOffsetMs({ sentAt: 0, receivedAt: 10, serverNow: 'kaputt' })
      ).toBeNull();
    });

    it('nimmt von mehreren Messungen die mit dem kürzesten Round-Trip', () => {
      const offset = bestClockOffset([
        // langsam, Ausreißer
        {
          sentAt: 0,
          receivedAt: 3000,
          serverNow: new Date(9000).toISOString(),
        },
        // schnell
        {
          sentAt: 5000,
          receivedAt: 5100,
          serverNow: new Date(7050).toISOString(),
        },
      ]);
      expect(offset).toBe(2000);
      expect(bestClockOffset([])).toBeNull();
    });

    it('rechnet die Gerätezeit in Serverzeit mit Millisekunden um', () => {
      expect(toServerTime(Date.UTC(2026, 9, 16, 12, 0, 0, 0), -1500)).toBe(
        '2026-10-16T11:59:58.500Z'
      );
    });
  });

  describe('Normierung auf die Angriffsrichtung', () => {
    it('lässt die Position stehen, wenn das Team nach rechts angreift', () => {
      expect(toAttackDirection({ x: 0.9, y: 0.2 }, true)).toEqual({
        x: 0.9,
        y: 0.2,
      });
    });

    it('dreht das Bild um 180 Grad, wenn das Team nach links angreift', () => {
      // Schuss kurz vor dem linken Tor, oben im Bild: aus Sicht des nach links
      // angreifenden Teams nahe der gegnerischen Torlinie und rechts.
      expect(toAttackDirection({ x: 0.1, y: 0.2 }, false)).toEqual({
        x: 0.9,
        y: 0.8,
      });
    });

    it('ist ihre eigene Umkehrung', () => {
      const screen = { x: 0.1234, y: 0.8765 };
      for (const right of [true, false]) {
        expect(
          fromAttackDirection(toAttackDirection(screen, right), right)
        ).toEqual(screen);
      }
    });

    it('begrenzt auf 0..1', () => {
      expect(toAttackDirection({ x: -0.2, y: 1.4 }, true)).toEqual({
        x: 0,
        y: 1,
      });
    });

    it('legt Schüsse beider Abschnitte nach dem Seitenwechsel aufeinander', () => {
      // Heim schießt im 1. Abschnitt aufs rechte, im 2. aufs linke Tor, beide
      // Male aus derselben Position vor dem Tor.
      const first = toAttackDirection({ x: 0.85, y: 0.4 }, true);
      const second = toAttackDirection({ x: 0.15, y: 0.6 }, false);
      expect(first).toEqual(second);
    });
  });

  describe('Seitenwahl', () => {
    it('wechselt ohne Einstellung die Seite je Abschnitt', () => {
      expect(leftToRightTeam(1, {})).toBe('home');
      expect(leftToRightTeam(2, {})).toBe('guest');
      expect(leftToRightTeam(3, {})).toBe('home');
    });

    it('folgt der Einstellung je Abschnitt', () => {
      expect(leftToRightTeam(1, { '1': 'guest' })).toBe('guest');
      expect(leftToRightTeam(2, { '1': 'guest' })).toBe('guest');
    });

    it('schlägt das Team nach der angetippten Hälfte vor', () => {
      expect(shootingTeamForTap(0.8, 1, {})).toBe('home');
      expect(shootingTeamForTap(0.2, 1, {})).toBe('guest');
      expect(shootingTeamForTap(0.8, 2, {})).toBe('guest');
    });
  });

  describe('Spielzeit', () => {
    it('akzeptiert m:ss und übliche Tippvarianten', () => {
      expect(normalizeGameTime('12:34')).toBe('12:34');
      expect(normalizeGameTime('12.34')).toBe('12:34');
      expect(normalizeGameTime('1234')).toBe('12:34');
      expect(normalizeGameTime('534')).toBe('5:34');
      expect(normalizeGameTime(' 0:07 ')).toBe('0:07');
    });

    it('lässt leer zu und weist Ungültiges ab', () => {
      expect(normalizeGameTime('')).toBe('');
      expect(normalizeGameTime(null)).toBe('');
      expect(normalizeGameTime('12:75')).toBeNull();
      expect(normalizeGameTime('abc')).toBeNull();
      expect(normalizeGameTime('5')).toBeNull();
    });
  });

  it('bietet nur spielbare Abschnitte an', () => {
    const titles = [
      { period: 1, status_id: 'period1', running: true },
      { period: 1.5, status_id: 'pause1', running: false },
      { period: 2, status_id: 'period2', running: true },
      { period: 4, status_id: 'extratime', running: true },
      { period: 5, status_id: 'penalty_shots', running: true },
    ] as Game['period_titles'];
    expect(playablePeriods(titles)).toEqual([1, 2, 4]);
    expect(playablePeriods([])).toEqual([1, 2, 3]);
  });

  describe('Torhüter vorbelegen', () => {
    const game = {
      players: {
        home: [
          { player_id: 11, goalkeeper: false },
          { player_id: 12, goalkeeper: true },
        ],
        guest: [{ player_id: 21, goalkeeper: false }],
      },
      starting_players: {
        home: [{ player_id: 13, position: 'goal' }],
        guest: [],
      },
    } as unknown as Game;

    it('nimmt zuerst den Torhüter der Startaufstellung', () => {
      expect(defaultGoalkeeperId(game, 'home')).toBe(13);
    });

    it('fällt auf den gemeldeten Torhüter im Kader zurück', () => {
      expect(
        defaultGoalkeeperId(
          { ...game, starting_players: { home: [], guest: [] } },
          'home'
        )
      ).toBe(12);
    });

    it('bleibt leer ohne Torhüter', () => {
      expect(defaultGoalkeeperId(game, 'guest')).toBeNull();
    });
  });

  it('legt gepufferte Änderungen über den Serverstand', () => {
    const server = [
      shot({ client_uuid: 'a', result: 'saved', event_id: null }),
      shot({
        client_uuid: 'b',
        tapped_at: '2026-10-16T12:01:00.000Z',
        event_id: 5,
      }),
      shot({ client_uuid: 'c', tapped_at: '2026-10-16T12:02:00.000Z' }),
    ];
    const pending: ShotInput[] = [
      {
        ...shot({
          client_uuid: 'b',
          tapped_at: '2026-10-16T12:01:00.000Z',
          result: 'missed',
        }),
      },
      { ...shot({ client_uuid: 'd', tapped_at: '2026-10-16T12:03:00.000Z' }) },
    ];

    const merged = mergeShots(server, pending, ['c']);

    expect(merged.map((entry) => entry.client_uuid)).toEqual(['d', 'b', 'a']);
    const b = merged.find((entry) => entry.client_uuid === 'b');
    expect(b?.result).toBe('missed');
    expect(b?.event_id).toBe(5);
    expect(b?.pending).toBeTrue();
  });

  describe('Zuordnungshilfe', () => {
    const goals = [
      { event_id: 1, event_type: 'goal', event_team: 'home' },
      { event_id: 2, event_type: 'goal', event_team: 'guest' },
      { event_id: 3, event_type: 'penalty', event_team: 'home' },
    ] as GameEvent[];

    it('ist leer, wenn alle Tore verknüpft sind', () => {
      const shots = [
        shot({ client_uuid: 'a', event_id: 1 }),
        shot({ client_uuid: 'b', team: 'guest', event_id: 2 }),
      ];
      expect(goalLinkCandidates(goals, shots)).toEqual([]);
    });

    it('bietet freie Tor-Schüsse desselben Teams an', () => {
      const shots = [
        shot({ client_uuid: 'a', event_id: 1 }),
        shot({ client_uuid: 'b', team: 'guest', result: 'goal' }),
        shot({ client_uuid: 'c', team: 'home', result: 'goal' }),
        shot({ client_uuid: 'd', team: 'guest', result: 'saved' }),
      ];
      const candidates = goalLinkCandidates(goals, shots);
      expect(candidates.length).toBe(1);
      expect(candidates[0].goal.event_id).toBe(2);
      expect(candidates[0].shots.map((entry) => entry.client_uuid)).toEqual([
        'b',
      ]);
    });

    it('bietet Eigentore und technische Tore nicht an', () => {
      const ohneSchuss = [
        {
          event_id: 4,
          event_type: 'goal',
          event_team: 'home',
          goal_type: 'owngoal',
        },
        {
          event_id: 5,
          event_type: 'goal',
          event_team: 'home',
          goal_type: 'technical',
        },
        {
          event_id: 6,
          event_type: 'goal',
          event_team: 'home',
          goal_type: 'regular',
        },
        // Technisches Tor mit „nicht angegeben“ (2000): Torart verdrängt.
        {
          event_id: 7,
          event_type: 'goal',
          event_team: 'home',
          goal_type: 'not_assigned',
          technical_goal: true,
        },
        {
          event_id: 8,
          event_type: 'goal',
          event_team: 'home',
          goal_type: 'not_assigned',
        },
      ] as GameEvent[];
      const candidates = goalLinkCandidates(ohneSchuss, [
        shot({ client_uuid: 'c', team: 'home', result: 'goal' }),
      ]);
      expect(candidates.map((entry) => entry.goal.event_id)).toEqual([6, 8]);
    });
  });

  it('erzeugt eindeutige UUIDs', () => {
    const first = newClientUuid();
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(newClientUuid()).not.toBe(first);
  });
});

describe('Freischläge (fe#589)', () => {
  const freeHit = (overrides: Partial<Shot> = {}) =>
    shot({
      client_uuid: 'f',
      kind: 'free_hit',
      result: null,
      tapped_at: '2026-10-16T12:00:00.000Z',
      ...overrides,
    });

  it('erkennt Freischläge am kind, ohne kind ist es ein Schuss', () => {
    expect(isFreeHit(freeHit())).toBeTrue();
    expect(isFreeHit(shot())).toBeFalse();
    expect(isFreeHit(shot({ kind: 'shot' }))).toBeFalse();
  });

  describe('followsFreeHit', () => {
    it('trifft einen Freischlag desselben Teams bis 10 s vor dem Schuss', () => {
      const shots = [freeHit()];
      expect(
        followsFreeHit(shots, 'home', '2026-10-16T12:00:00.000Z')
      ).toBeTrue();
      expect(
        followsFreeHit(shots, 'home', '2026-10-16T12:00:10.000Z')
      ).toBeTrue();
      expect(
        followsFreeHit(shots, 'home', '2026-10-16T12:00:10.001Z')
      ).toBeFalse();
    });

    it('ignoriert das andere Team, spätere Freischläge und Schüsse', () => {
      expect(
        followsFreeHit([freeHit()], 'guest', '2026-10-16T12:00:05.000Z')
      ).toBeFalse();
      expect(
        followsFreeHit([freeHit()], 'home', '2026-10-16T11:59:59.000Z')
      ).toBeFalse();
      expect(
        followsFreeHit([shot()], 'home', '2026-10-16T12:00:05.000Z')
      ).toBeFalse();
    });

    it('liefert ohne lesbaren Zeitpunkt false', () => {
      expect(followsFreeHit([freeHit()], 'home', '')).toBeFalse();
    });
  });

  it('bietet Freischläge nie zur Tor-Zuordnung an, auch nicht mit Ergebnis', () => {
    const goal = {
      event_id: 5,
      event_type: 'goal',
      event_team: 'home',
      period: 1,
    } as GameEvent;
    expect(goalLinkCandidates([goal], [freeHit({ result: 'goal' })])).toEqual(
      []
    );
  });

  describe('Strafschuss und Torwartsituation (Feedback #61, #63, #64)', () => {
    it('„Torwart raus“ gilt nur im Abschnitt, in dem geschaltet wurde', () => {
      expect(goaliePulled({ guest: 3 }, 'guest', 3)).toBeTrue();
      expect(goaliePulled({ guest: 3 }, 'guest', 4)).toBeFalse();
      expect(goaliePulled({ guest: 3 }, 'home', 3)).toBeFalse();
    });

    it('leitet leeres Tor und 6 gegen 5 aus Sicht des schießenden Teams ab', () => {
      expect(situationFor({ guest: 3 }, 'home', 3)).toEqual({
        empty_net: true,
        extra_attacker: false,
      });
      expect(situationFor({ guest: 3 }, 'guest', 3)).toEqual({
        empty_net: false,
        extra_attacker: true,
      });
      expect(situationFor({ home: 3, guest: 3 }, 'home', 3)).toEqual({
        empty_net: true,
        extra_attacker: true,
      });
    });

    it('bringt widersprüchliche Kennungen in eine Form, die die API annimmt', () => {
      const base = shot({ result: 'goal', goalkeeper_player_id: 5 });
      expect(
        consistentShotFlags({
          ...base,
          from_penalty_shot: true,
          from_free_hit: true,
          empty_net: true,
          extra_attacker: true,
        })
      ).toEqual(
        jasmine.objectContaining({
          from_penalty_shot: true,
          from_free_hit: false,
          empty_net: false,
          extra_attacker: false,
          goalkeeper_player_id: 5,
        })
      );
      expect(
        consistentShotFlags({ ...base, empty_net: true }).goalkeeper_player_id
      ).toBeNull();
      expect(
        consistentShotFlags({ ...base, result: 'saved', empty_net: true })
          .empty_net
      ).toBeFalse();
      expect(
        consistentShotFlags({
          ...base,
          result: 'blocked',
          from_penalty_shot: true,
        }).from_penalty_shot
      ).toBeFalse();
      expect(
        consistentShotFlags({
          ...base,
          kind: 'free_hit',
          result: null,
          empty_net: true,
        }).empty_net
      ).toBeFalse();
    });

    it('erkennt die Parade ohne Position', () => {
      expect(
        isUnplacedSave(shot({ result: 'saved', x: null, y: null }))
      ).toBeTrue();
      expect(isUnplacedSave(shot({ result: 'saved' }))).toBeFalse();
      expect(
        isUnplacedSave(shot({ kind: 'mark', result: null, x: null, y: null }))
      ).toBeFalse();
    });
  });
});
