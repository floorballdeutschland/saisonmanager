import { HighlightScene } from '@floorball/types';
import {
  hasPlayableHighlights,
  nextSceneIndex,
  personLabel,
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
