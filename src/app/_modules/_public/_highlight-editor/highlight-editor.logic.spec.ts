import { HighlightEditorData, HighlightEditorScene } from '@floorball/types';

import {
  buildUpdate,
  calibrationStart,
  clampOffset,
  formatVideoTime,
  hasChanges,
  measureOffset,
  sceneWindow,
} from './highlight-editor.logic';

function scene(
  overrides: Partial<HighlightEditorScene> = {}
): HighlightEditorScene {
  return {
    client_uuid: 'a',
    kind: 'goal',
    label: '1:0 Müller',
    team: 'home',
    period: 1,
    game_time: '05:00',
    anchor_second: 600,
    start: 585,
    end: 605,
    in_highlights: true,
    ...overrides,
  };
}

function data(
  overrides: Partial<HighlightEditorData> = {}
): HighlightEditorData {
  return {
    game: {
      id: 1,
      game_number: '7',
      home_team_name: 'A',
      guest_team_name: 'B',
    },
    video_id: 'vid',
    offset_seconds: null,
    calibrated_at: null,
    calibration_scene: { client_uuid: 'a', anchor_second: 600 },
    scenes: [scene(), scene({ client_uuid: 'b', kind: 'mark' })],
    ...overrides,
  };
}

describe('highlight-editor.logic', () => {
  it('misst den Versatz als Abspielposition minus Antippen, gerundet', () => {
    // Das Bild liegt 21,6 s hinter der Halle.
    expect(measureOffset(621.6, 600)).toBe(22);
    expect(measureOffset(590.2, 600)).toBe(-10);
  });

  it('begrenzt den Versatz auf den Bereich der API', () => {
    expect(clampOffset(500)).toBe(120);
    expect(clampOffset(-500)).toBe(-120);
    expect(measureOffset(1000, 600)).toBe(120);
  });

  it('startet die Kalibrierszene ohne Versatz 10 s vor dem Antippen', () => {
    expect(calibrationStart(600, null)).toBe(590);
    // Mit Versatz 20 s vor der verschobenen Stelle.
    expect(calibrationStart(600, 25)).toBe(605);
    // Nie vor dem Anfang des Videos.
    expect(calibrationStart(5, null)).toBe(0);
  });

  it('rechnet Szenen wie die API: unkalibriert 15/5, kalibriert 12/8 um die verschobene Stelle', () => {
    expect(sceneWindow(scene(), null)).toEqual({ start: 585, end: 605 });
    expect(sceneWindow(scene(), 20)).toEqual({ start: 608, end: 628 });
    expect(sceneWindow(scene(), 0)).toEqual({ start: 588, end: 608 });
  });

  it('bleibt ohne Anker beim Fenster der API', () => {
    expect(
      sceneWindow(scene({ anchor_second: null, start: 10, end: 30 }), 25)
    ).toEqual({ start: 10, end: 30 });
  });

  it('schickt nur, was sich geändert hat', () => {
    const loaded = data();
    expect(hasChanges(buildUpdate(loaded, null, { a: true, b: true }))).toBe(
      false
    );

    expect(buildUpdate(loaded, 18, { a: true, b: false })).toEqual({
      offset_seconds: 18,
      scenes: [{ client_uuid: 'b', in_highlights: false }],
    });
  });

  it('nimmt die Kalibrierung mit null zurück', () => {
    const update = buildUpdate(data({ offset_seconds: 18 }), null, {});
    expect(update).toEqual({ offset_seconds: null });
    expect(hasChanges(update)).toBe(true);
  });

  it('zeigt Videostellen wie YouTube', () => {
    expect(formatVideoTime(65)).toBe('1:05');
    expect(formatVideoTime(3725)).toBe('1:02:05');
    expect(formatVideoTime(-3)).toBe('0:00');
  });
});
