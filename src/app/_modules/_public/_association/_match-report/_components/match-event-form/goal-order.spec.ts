import { GameEvent } from '@floorball/types';
import { countRewrittenGoalScores } from './goal-order';

function goal(id: number, time: string, team: string, period = 1): GameEvent {
  return { event_id: id, event_type: 'goal', event_team: team, period, time };
}

describe('countRewrittenGoalScores', () => {
  // Spiel 58665: Heimtor 6:33 erfasst, danach das Gasttor 9:13 als 3:13.
  const events = [goal(1, '6:33', 'home')];

  it('zählt das Tor, dessen Stand ein früheres Tor umschreibt', () => {
    expect(
      countRewrittenGoalScores(events, {
        period: 1,
        time: '3:13',
        team: 'guest',
      })
    ).toBe(1);
  });

  it('lässt ein Tor nach dem letzten Tor durch', () => {
    expect(
      countRewrittenGoalScores(events, {
        period: 1,
        time: '9:13',
        team: 'guest',
      })
    ).toBe(0);
  });

  // "9:13" sortiert ohne Auffüllen hinter "10:00" ein.
  it('vergleicht Zeiten wie die API mit führender Null', () => {
    expect(
      countRewrittenGoalScores([goal(1, '10:00', 'home')], {
        period: 1,
        time: '9:13',
        team: 'guest',
      })
    ).toBe(1);
  });

  it('ordnet zuerst nach Abschnitt', () => {
    expect(
      countRewrittenGoalScores([goal(1, '19:00', 'home', 1)], {
        period: 2,
        time: '0:30',
        team: 'guest',
      })
    ).toBe(0);
  });

  // Gleiche Zeit: das neue Tor bekommt die höhere id und steht dahinter.
  it('lässt ein Tor zur selben Zeit wie das letzte durch', () => {
    expect(
      countRewrittenGoalScores(events, {
        period: 1,
        time: '6:33',
        team: 'guest',
      })
    ).toBe(0);
  });

  it('ignoriert Strafen und Auszeiten', () => {
    const withOthers: GameEvent[] = [
      ...events,
      {
        event_id: 2,
        event_type: 'penalty',
        event_team: 'home',
        period: 1,
        time: '8:00',
      },
      {
        event_id: 9001,
        event_type: 'timeout',
        event_team: 'home',
        period: 1,
        time: '9:00',
      },
    ];
    expect(
      countRewrittenGoalScores(withOthers, {
        period: 1,
        time: '7:00',
        team: 'guest',
      })
    ).toBe(0);
  });

  describe('beim Bearbeiten', () => {
    const two = [goal(1, '3:13', 'guest'), goal(2, '6:33', 'home')];

    it('zählt nicht den Stand des bearbeiteten Tors selbst', () => {
      expect(
        countRewrittenGoalScores(
          two,
          { period: 1, time: '4:00', team: 'guest' },
          1
        )
      ).toBe(0);
    });

    it('zählt, wenn das Tor hinter ein anderes rutscht', () => {
      expect(
        countRewrittenGoalScores(
          two,
          { period: 1, time: '9:13', team: 'guest' },
          1
        )
      ).toBe(1);
    });

    it('zählt einen Mannschaftswechsel bei einem früheren Tor', () => {
      expect(
        countRewrittenGoalScores(
          two,
          { period: 1, time: '3:13', team: 'home' },
          1
        )
      ).toBe(1);
    });
  });
});
