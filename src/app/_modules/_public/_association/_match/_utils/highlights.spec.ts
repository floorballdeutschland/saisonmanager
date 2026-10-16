import { DetailedStatsShot, HighlightScene } from '@floorball/types';
import {
  hasPlayableHighlights,
  nextSceneIndex,
  parseGameTime,
  personLabel,
  sceneIndexForShot,
} from './highlights';

function scene(overrides: Partial<HighlightScene> = {}): HighlightScene {
  return {
    event_id: 1,
    start: 10,
    end: 30,
    team: 'home',
    home_goals: 1,
    guest_goals: 0,
    period: 1,
    game_time: '05:00',
    scorer: null,
    assist: null,
    ...overrides,
  };
}

function goal(overrides: Partial<DetailedStatsShot> = {}): DetailedStatsShot {
  return {
    team: 'home',
    period: 1,
    game_time: '05:00',
    x: 0.9,
    y: 0.5,
    result: 'goal',
    shooter: null,
    ...overrides,
  };
}

describe('highlights utils', () => {
  it('hasPlayableHighlights verlangt Video und mindestens eine Szene', () => {
    expect(hasPlayableHighlights(null)).toBeFalse();
    expect(hasPlayableHighlights(undefined)).toBeFalse();
    expect(
      hasPlayableHighlights({ video_id: null, scenes: [scene()] })
    ).toBeFalse();
    expect(hasPlayableHighlights({ video_id: 'abc', scenes: [] })).toBeFalse();
    expect(
      hasPlayableHighlights({ video_id: 'abc', scenes: [scene()] })
    ).toBeTrue();
  });

  it('parseGameTime liest m:ss und mm:ss', () => {
    expect(parseGameTime('5:07')).toBe(307);
    expect(parseGameTime('45:00')).toBe(2700);
    expect(parseGameTime('')).toBeNull();
    expect(parseGameTime('abc')).toBeNull();
  });

  describe('sceneIndexForShot', () => {
    const scenes = [
      scene({ event_id: 1, team: 'home', period: 1, game_time: '05:00' }),
      scene({ event_id: 2, team: 'guest', period: 1, game_time: '05:20' }),
      scene({ event_id: 3, team: 'home', period: 2, game_time: '25:00' }),
      scene({ event_id: 4, team: 'home', period: 2, game_time: '26:30' }),
    ];

    it('nimmt bei event_id genau die Szene dieses Tores', () => {
      expect(sceneIndexForShot(goal({ event_id: 4 }), scenes)).toBe(3);
      expect(sceneIndexForShot(goal({ event_id: 99 }), scenes)).toBe(-1);
    });

    it('sucht ohne event_id die nächste Szene desselben Teams und Abschnitts', () => {
      expect(
        sceneIndexForShot(goal({ period: 2, game_time: '26:10' }), scenes)
      ).toBe(3);
      expect(
        sceneIndexForShot(goal({ period: 2, game_time: '24:50' }), scenes)
      ).toBe(2);
      // Gleiche Zeit, aber anderes Team
      expect(
        sceneIndexForShot(goal({ team: 'guest', game_time: '05:00' }), scenes)
      ).toBe(1);
    });

    it('ordnet nichts zu, was weiter als die Toleranz entfernt liegt', () => {
      expect(
        sceneIndexForShot(goal({ period: 1, game_time: '07:00' }), scenes)
      ).toBe(-1);
    });

    it('gibt nur Toren eine Szene', () => {
      expect(sceneIndexForShot(goal({ result: 'saved' }), scenes)).toBe(-1);
    });
  });

  it('nextSceneIndex geht weiter und endet nach der letzten Szene', () => {
    expect(nextSceneIndex(0, 3)).toBe(1);
    expect(nextSceneIndex(1, 3)).toBe(2);
    expect(nextSceneIndex(2, 3)).toBeNull();
  });

  it('personLabel stellt die Trikotnummer voran, wenn es eine gibt', () => {
    expect(personLabel({ trikot_number: 7, name: 'B. Vorlage' })).toBe(
      '#7 B. Vorlage'
    );
    expect(personLabel({ trikot_number: null, name: 'B. Vorlage' })).toBe(
      'B. Vorlage'
    );
    expect(personLabel(null)).toBe('');
  });
});
