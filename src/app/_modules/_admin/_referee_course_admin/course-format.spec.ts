import {
  centsToEuro,
  euroToCents,
  isoToLocalInput,
  localInputToIso,
} from './course-format';

describe('course-format', () => {
  it('rechnet Euro und Cent um', () => {
    expect(euroToCents('25')).toBe(2500);
    expect(euroToCents('25,5')).toBe(2550);
    expect(euroToCents('12.50')).toBe(1250);
    expect(euroToCents('')).toBeNull();
    expect(euroToCents('zehn')).toBeNaN();
    expect(centsToEuro(2550)).toBe('25,50');
    expect(centsToEuro(null)).toBe('');
  });

  it('macht aus datetime-local und zurueck denselben Zeitpunkt', () => {
    const iso = localInputToIso('2026-11-21T09:30');
    expect(iso).not.toBeNull();
    expect(isoToLocalInput(iso)).toBe('2026-11-21T09:30');
    expect(localInputToIso('')).toBeNull();
  });
});
