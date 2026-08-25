import { DatePipe } from '@angular/common';
import { SafeDatePipe } from './safe-date.pipe';

describe('SafeDatePipe', () => {
  let pipe: SafeDatePipe;

  beforeEach(() => {
    pipe = new SafeDatePipe(new DatePipe('en-US'));
  });

  it('formatiert einen gültigen Zeitstempel', () => {
    expect(pipe.transform('2026-08-24T19:16:15Z', 'dd.MM.yyyy')).toBe(
      '24.08.2026'
    );
  });

  it('gibt bei leeren Werten null zurück', () => {
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform(undefined)).toBeNull();
    expect(pipe.transform('')).toBeNull();
  });

  it('reicht einen unlesbaren Altdaten-Wert durch, statt zu werfen', () => {
    // Die Angular-DatePipe wirft hier NG02100 und nimmt mit der Change
    // Detection die ganze Maske mit.
    expect(() => new DatePipe('en-US').transform('unbekannt')).toThrow();

    expect(pipe.transform('unbekannt')).toBe('unbekannt');
  });
});
