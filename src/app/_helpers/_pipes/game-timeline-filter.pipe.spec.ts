import { GameTimelineFilterPipe } from './game-timeline-filter.pipe';
import { Game, PeriodTitles } from '@floorball/types';

describe('GameTimelineFilterPipe', () => {
  let pipe: GameTimelineFilterPipe;

  beforeEach(() => {
    pipe = new GameTimelineFilterPipe();
  });

  function period(status_id: string, optional = false): PeriodTitles {
    return {
      status_id,
      optional,
      period: 1,
      short_title: '',
      title: '',
      running: false,
      can_end_game: false,
    };
  }

  function mockPeriodTitle(optional = false): PeriodTitles {
    return {
      period: 1,
      short_title: '',
      title: '',
      status_id: '',
      running: false,
      can_end_game: false,
      optional,
    };
  }

  function game(ingame_status: string, ended: boolean, optional = false): Game {
    return {
      ended,
      ingame_status,
      current_period_title: mockPeriodTitle(optional),
    } as unknown as Game;
  }

  it('gibt alle Perioden zurück wenn Spiel nicht beendet', () => {
    const periods = [period('p1'), period('p2'), period('p3')];
    const result = pipe.transform(periods, game('p1', false));
    expect(result.length).toBe(3);
  });

  it('filtert Perioden nach optional-Flag von current_period_title', () => {
    const periods = [period('p1', false), period('p2', true)];
    const result = pipe.transform(periods, game('p1', false, false));
    expect(result.length).toBe(1);
    expect(result[0].status_id).toBe('p1');
  });

  it('bei beendetem Spiel nur aktive und vergangene Perioden', () => {
    const periods = [period('p1'), period('p2'), period('p3')];
    // p2 ist aktuell, Spiel beendet → p1 und p2 sichtbar, p3 nicht
    const result = pipe.transform(periods, game('p2', true));
    const ids = result.map((p) => p.status_id);
    expect(ids).toContain('p1');
    expect(ids).toContain('p2');
    expect(ids).not.toContain('p3');
  });

  it('leere Periode-Liste ergibt leere Liste', () => {
    expect(pipe.transform([], game('x', false))).toEqual([]);
  });
});
