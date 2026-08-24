import { isGermanDateExpired, parseGermanDate } from './german-date';

describe('parseGermanDate', () => {
  it('liest das Format TT.MM.JJJJ', () => {
    const parsed = parseGermanDate('30.06.2031');

    expect(parsed).not.toBeNull();
    expect(parsed!.getFullYear()).toBe(2031);
    expect(parsed!.getMonth()).toBe(5);
    expect(parsed!.getDate()).toBe(30);
  });

  it('liefert null ohne Angabe', () => {
    expect(parseGermanDate(undefined)).toBeNull();
    expect(parseGermanDate(null)).toBeNull();
    expect(parseGermanDate('')).toBeNull();
  });

  // Der Date-Konstruktor macht aus dem 31.02. still den 3. Maerz. Ein solcher
  // Wert ist keine Gueltigkeit, sondern ein Tippfehler.
  it('weist ein Datum ab, das es nicht gibt', () => {
    expect(parseGermanDate('31.02.2026')).toBeNull();
    expect(parseGermanDate('32.01.2026')).toBeNull();
    expect(parseGermanDate('01.13.2026')).toBeNull();
  });

  it('weist andere Formate ab', () => {
    expect(parseGermanDate('2026-06-30')).toBeNull();
    expect(parseGermanDate('30.06.31')).toBeNull();
    expect(parseGermanDate('irgendwas')).toBeNull();
  });
});

describe('isGermanDateExpired', () => {
  function germanDate(offsetInDays: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetInDays);
    return [
      String(date.getDate()).padStart(2, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      date.getFullYear(),
    ].join('.');
  }

  it('vergleicht mit heute', () => {
    expect(isGermanDateExpired('01.01.2020')).toBeTrue();
    expect(isGermanDateExpired('31.12.2099')).toBeFalse();
  });

  // Die Tagesgrenze ist der Kern: Der Ablauftag selbst zaehlt noch als
  // gueltig, so wie die API rechnet (`gueltigkeit >= Date.current`) und die
  // Ansetzung eine Qualifikation an diesem Tag noch anerkennt. Verglichen wird
  // deshalb gegen den Tagesbeginn und nicht gegen die aktuelle Uhrzeit.
  it('laesst den Ablauftag selbst noch gelten', () => {
    expect(isGermanDateExpired(germanDate(-1))).toBeTrue();
    expect(isGermanDateExpired(germanDate(0))).toBeFalse();
    expect(isGermanDateExpired(germanDate(1))).toBeFalse();
  });

  // Ohne Angabe gibt es keine Aussage: Eine Zusatzqualifikation ohne
  // hinterlegten Ablauf darf nicht als abgelaufen gezeichnet werden.
  it('ist ohne Angabe nicht abgelaufen', () => {
    expect(isGermanDateExpired(undefined)).toBeFalse();
    expect(isGermanDateExpired('')).toBeFalse();
  });

  // Umgekehrt bei einem vorhandenen, aber unlesbaren Wert: Im Zweifel nicht
  // faelschlich „gueltig“ melden.
  it('gilt bei unlesbarer Angabe als abgelaufen', () => {
    expect(isGermanDateExpired('31.02.2099')).toBeTrue();
    expect(isGermanDateExpired('kaputt')).toBeTrue();
  });
});
