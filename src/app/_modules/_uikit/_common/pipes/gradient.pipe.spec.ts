import { GameOperation } from '@floorball/types';
import associationJson from '../../../../associations.json';

import { GradientPipe } from './gradient.pipe';

describe('GradientPipe', () => {
  let pipe: GradientPipe;

  const SCHWARZ = '90deg, #000000, #000000';

  beforeEach(() => {
    pipe = new GradientPipe();
  });

  function spielbetrieb(overrides: Partial<GameOperation> = {}): GameOperation {
    return {
      id: 1,
      name: 'Floorball Deutschland',
      path: 'fd',
      ...overrides,
    } as GameOperation;
  }

  it('liefert den Verlauf des Spielbetriebs', () => {
    expect(pipe.transform(spielbetrieb())).toContain('#B21917');
  });

  /**
   * Der Regressionsfall: Zugeordnet wurde ueber `path`, und associations.json
   * trug die Slugs des Altsystems (`fvd`, `fvn`, `sbkost`, `nwuv`). Vier von
   * zehn Verbaenden liefen damit in den schwarzen Rueckfall, ohne dass etwas
   * scheiterte -- die Farben fehlten einfach.
   */
  it('ordnet ueber die id zu, nicht ueber den Pfad', () => {
    const umbenannt = spielbetrieb({ path: 'ganz-anders' });

    expect(pipe.transform(umbenannt)).toContain('#B21917');
    expect(pipe.transform(umbenannt)).not.toBe(SCHWARZ);
  });

  it('faellt bei unbekanntem Spielbetrieb auf Schwarz zurueck', () => {
    expect(pipe.transform(spielbetrieb({ id: 999 }))).toBe(SCHWARZ);
  });

  it('faellt ohne Spielbetrieb auf Schwarz zurueck', () => {
    expect(pipe.transform(null)).toBe(SCHWARZ);
    expect(pipe.transform(undefined)).toBe(SCHWARZ);
  });

  /**
   * Die Pfade in associations.json sind seit der Umstellung auf die id keine
   * Zuordnung mehr, sondern Beschriftung. Sie sollen trotzdem stimmen, sonst
   * liest der naechste sie als Wahrheit -- genau daran hing der Fehler oben.
   */
  it('haelt jede id genau einmal', () => {
    const ids = associationJson.map((a) => a.id);

    expect(ids.length).toBe(new Set(ids).size);
  });

  it('gibt jedem Eintrag einen Verlauf und einen Pfad', () => {
    associationJson.forEach((a) => {
      expect(a.gradient).toContain('linear-gradient');
      expect(a.path).toMatch(/^[a-z]+$/);
    });
  });
});
